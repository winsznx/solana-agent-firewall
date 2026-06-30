/**
 * Produce real and crafted transaction fixtures for the firewall test suite.
 *
 * Output:
 *   test/fixtures/<name>.b64
 *   test/fixtures/<name>.json
 *   test/fixtures/MANIFEST.json
 *
 * Run:
 *   export SOLANA_RPC_URL="https://<your-mainnet-rpc>"
 *   export FIXTURE_FROM_ADDRESS="<mainnet wallet that currently holds a little SOL>"
 *   export FIXTURE_T22_MINT="<verified Token-2022 mint with PermanentDelegate>"
 *   pnpm fetch:fixtures
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type VersionedMessage
} from "@solana/web3.js";

const SPL_TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const JUPITER_V6 = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const INCINERATOR = new PublicKey("1nc1nerator11111111111111111111111111111111");

const OUT_DIR = process.env.FIXTURE_OUT_DIR ?? join("test", "fixtures");
const RPC_URL = process.env.SOLANA_RPC_URL ?? "";
const FROM_ADDRESS = process.env.FIXTURE_FROM_ADDRESS ?? "";
const T22_MINT = process.env.FIXTURE_T22_MINT ?? "";
const FIXED_BLOCKHASH = PublicKey.default.toBase58();

type Verdict = "ALLOW" | "WARN" | "BLOCK";

type FixtureAssertions = {
  minLookupTableCount?: number;
  noCriticalFindings?: boolean;
  noUnknownProgramFindings?: boolean;
  simulationRan?: boolean;
  simulationSuccess?: boolean;
  solDeltaNegative?: boolean;
  intentMatches?: boolean;
};

type Meta = {
  name: string;
  kind: "offline" | "onchain";
  expectedVerdict?: Verdict;
  acceptableVerdicts?: Verdict[];
  mustContainFindings?: string[];
  assertions?: FixtureAssertions;
  requiresRpc?: boolean;
  intent?: string;
  signature?: string;
  slot?: number;
  explorer?: string;
  source: string;
  notes?: string;
};

const results: { name: string; ok: boolean; detail: string }[] = [];

function ensureOut(): void {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }
}

function save(b64: string, meta: Meta): void {
  ensureOut();
  writeFileSync(join(OUT_DIR, `${meta.name}.b64`), b64, "utf8");
  writeFileSync(join(OUT_DIR, `${meta.name}.json`), JSON.stringify(meta, null, 2), "utf8");
  const verdict = meta.expectedVerdict ?? meta.acceptableVerdicts?.join("|") ?? "assertions-only";
  results.push({ name: meta.name, ok: true, detail: `${verdict} · ${b64.length}b64` });
  console.log(`  ok ${meta.name.padEnd(28)} expect ${verdict}`);
}

function skip(name: string, why: string): void {
  results.push({ name, ok: false, detail: `skipped: ${why}` });
  console.log(`  -- ${name.padEnd(28)} skipped: ${why}`);
}

function toB64(tx: VersionedTransaction): string {
  return Buffer.from(tx.serialize()).toString("base64");
}

function unsignedV0(payer: PublicKey, instructions: TransactionInstruction[]): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: FIXED_BLOCKHASH,
    instructions
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

function buildDrain(): void {
  const victim = Keypair.generate().publicKey;
  const tokenAccount = Keypair.generate().publicKey;
  const delegate = Keypair.generate().publicKey;
  const attacker = Keypair.generate().publicKey;

  const approveData = Buffer.alloc(9);
  approveData[0] = 4;
  approveData.writeBigUInt64LE((1n << 64n) - 1n, 1);

  const approve = new TransactionInstruction({
    programId: SPL_TOKEN,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: victim, isSigner: true, isWritable: false }
    ],
    data: approveData
  });

  const close = new TransactionInstruction({
    programId: SPL_TOKEN,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: attacker, isSigner: false, isWritable: true },
      { pubkey: victim, isSigner: true, isWritable: false }
    ],
    data: Buffer.from([9])
  });

  save(toB64(unsignedV0(victim, [approve, close])), {
    name: "drain-approve-close",
    kind: "offline",
    expectedVerdict: "BLOCK",
    mustContainFindings: ["UNLIMITED_APPROVE", "ACCOUNT_CLOSE_DRAIN"],
    source: "crafted locally",
    notes: "Unlimited delegate plus close-to-non-signer. Deterministic, no network."
  });
}

function buildIntentMismatch(): void {
  const victim = Keypair.generate().publicKey;
  const tokenAccount = Keypair.generate().publicKey;
  const attacker = Keypair.generate().publicKey;
  const data = Buffer.concat([Buffer.from([6, 2, 1]), attacker.toBuffer()]);

  const setAuthority = new TransactionInstruction({
    programId: SPL_TOKEN,
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: victim, isSigner: true, isWritable: false }
    ],
    data
  });

  save(toB64(unsignedV0(victim, [setAuthority])), {
    name: "intent-mismatch-setauthority",
    kind: "offline",
    expectedVerdict: "WARN",
    mustContainFindings: ["INTENT_MISMATCH", "ACCOUNT_OWNER_CHANGE"],
    assertions: { intentMatches: false },
    intent: "swap 1 SOL for USDC on Jupiter",
    source: "crafted locally",
    notes: "Claim-vs-reality fixture: stated swap intent, actual SetAuthority(AccountOwner)."
  });
}

function buildTransfer(): void {
  if (!FROM_ADDRESS) {
    skip("transfer-allow", "set FIXTURE_FROM_ADDRESS to a wallet that holds a little SOL");
    return;
  }

  let from: PublicKey;
  try {
    from = new PublicKey(FROM_ADDRESS);
  } catch {
    skip("transfer-allow", "FIXTURE_FROM_ADDRESS is not a valid pubkey");
    return;
  }

  const instruction = SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: INCINERATOR,
    lamports: 5_000
  });

  save(toB64(unsignedV0(from, [instruction])), {
    name: "transfer-allow",
    kind: "offline",
    expectedVerdict: "ALLOW",
    requiresRpc: true,
    assertions: {
      simulationRan: true,
      simulationSuccess: true,
      solDeltaNegative: true
    },
    source: `built from FIXTURE_FROM_ADDRESS=${FROM_ADDRESS}`,
    notes: "Built offline; the firewall simulates it live. Use a funded source so this is the clean ALLOW showcase."
  });
}

function hasAlt(message: VersionedMessage): boolean {
  return "addressTableLookups" in message && ((message as { addressTableLookups?: unknown[] }).addressTableLookups?.length ?? 0) > 0;
}

async function discover(
  connection: Connection,
  address: PublicKey,
  opts: { requireAlt?: boolean; limit?: number }
): Promise<{ b64: string; signature: string; slot: number; alt: boolean } | null> {
  const signatures = await connection.getSignaturesForAddress(address, { limit: opts.limit ?? 40 });
  for (const signature of signatures) {
    if (signature.err) {
      continue;
    }
    const response = await connection.getTransaction(signature.signature, { maxSupportedTransactionVersion: 0 });
    if (!response) {
      continue;
    }
    const message = response.transaction.message as VersionedMessage;
    if (opts.requireAlt && !hasAlt(message)) {
      continue;
    }
    const rebuilt = new VersionedTransaction(message);
    return {
      b64: toB64(rebuilt),
      signature: signature.signature,
      slot: response.slot,
      alt: hasAlt(message)
    };
  }
  return null;
}

async function buildJupiterSwap(connection: Connection): Promise<void> {
  const found = await discover(connection, JUPITER_V6, { requireAlt: true });
  if (!found) {
    skip("jupiter-swap", "no recent Jupiter v0+ALT transaction found");
    return;
  }

  save(found.b64, {
    name: "jupiter-swap",
    kind: "onchain",
    acceptableVerdicts: ["ALLOW", "WARN"],
    requiresRpc: true,
    assertions: {
      minLookupTableCount: 1,
      noCriticalFindings: true,
      noUnknownProgramFindings: true,
      simulationRan: true
    },
    signature: found.signature,
    slot: found.slot,
    explorer: `https://solscan.io/tx/${found.signature}`,
    source: "discovered via getSignaturesForAddress(Jupiter v6)",
    notes:
      "Historical swaps can WARN when current pool state makes re-simulation fail. Assert ALT resolution, known programs, and no false CRITICAL instead of forcing ALLOW."
  });
}

async function buildToken2022(connection: Connection): Promise<void> {
  if (!T22_MINT) {
    skip("token2022-permanent-delegate", "set FIXTURE_T22_MINT to a verified Token-2022 mint with PermanentDelegate");
    return;
  }

  let mint: PublicKey;
  try {
    mint = new PublicKey(T22_MINT);
  } catch {
    skip("token2022-permanent-delegate", "FIXTURE_T22_MINT is not a valid pubkey");
    return;
  }

  const found = await discover(connection, mint, { requireAlt: false });
  if (!found) {
    skip("token2022-permanent-delegate", "no recent transaction found referencing that mint");
    return;
  }

  save(found.b64, {
    name: "token2022-permanent-delegate",
    kind: "onchain",
    expectedVerdict: "BLOCK",
    requiresRpc: true,
    mustContainFindings: ["T22_PERMANENT_DELEGATE"],
    signature: found.signature,
    slot: found.slot,
    explorer: `https://solscan.io/tx/${found.signature}`,
    source: `discovered via getSignaturesForAddress(${T22_MINT})`,
    notes:
      "The detector reads current mint extensions. Verify the mint actually carries PermanentDelegate before trusting this fixture."
  });
}

async function main(): Promise<void> {
  console.log(`\nWriting fixtures to ${OUT_DIR}/\n`);

  console.log("offline:");
  buildDrain();
  buildIntentMismatch();
  buildTransfer();

  console.log("\non-chain:");
  if (!RPC_URL) {
    skip("jupiter-swap", "set SOLANA_RPC_URL");
    skip("token2022-permanent-delegate", "set SOLANA_RPC_URL");
  } else {
    const connection = new Connection(RPC_URL, "confirmed");
    await buildJupiterSwap(connection);
    await buildToken2022(connection);
  }

  const manifest = results.filter((result) => result.ok).map((result) => result.name);
  ensureOut();
  writeFileSync(join(OUT_DIR, "MANIFEST.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log("\nsummary:");
  for (const result of results) {
    console.log(`  ${result.ok ? "ok" : "--"} ${result.name.padEnd(30)} ${result.detail}`);
  }
  console.log(`\n${manifest.length}/${results.length} fixtures written. MANIFEST.json updated.\n`);
}

main().catch((error) => {
  console.error("fatal:", error);
  process.exit(1);
});
