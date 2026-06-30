import { unpackMint, getExtensionTypes } from "@solana/spl-token";
import { PublicKey, type AccountInfo, type Connection } from "@solana/web3.js";
import {
  BUILT_IN_ALLOWLIST,
  KNOWN_INFRA_OR_POOL_ACCOUNTS,
  PROGRAMS,
  VERIFIED_SAFE_MINTS,
  programRisk
} from "./allowlist.js";
import { extensionTypeName, parseMintBase, parseTokenAccountInfo } from "./account-decode.js";
import { getMultipleAccountsMap, TtlCache } from "./rpc.js";
import type { EnrichmentResult, MintRisk, PolicyConfig, ProgramRisk, TransactionContext } from "./types.js";
import { unique } from "./utils.js";

const mintCache = new TtlCache<MintRisk>(5 * 60_000);
const programCache = new TtlCache<ProgramRisk>(5 * 60_000);

export async function enrichTransaction(
  context: TransactionContext,
  connection: Connection | undefined,
  policy: PolicyConfig
): Promise<EnrichmentResult> {
  if (!connection) {
    return {
      ran: false,
      unknownChecks: ["rpc-unavailable"],
      mints: [],
      programs: context.decodedInstructions.map((instruction) => programRisk(instruction.programId, policy.programs.allow))
    };
  }

  const programIds = unique(context.decodedInstructions.map((instruction) => instruction.programId).filter((id) => !id.startsWith("unresolved:")));
  const accountMap = await getMultipleAccountsMap(connection, unique([...programIds, ...context.writableKeys]));
  const tokenAccountMints = context.writableKeys
    .map((address) => parseTokenAccountInfo(accountMap.get(address) ?? null))
    .filter((account): account is NonNullable<typeof account> => Boolean(account))
    .map((account) => account.mint);
  const instructionMints = context.decodedInstructions
    .map((instruction) => instruction.params?.mint)
    .filter((mint): mint is string => typeof mint === "string");
  const mintIds = unique([...tokenAccountMints, ...instructionMints]);

  const programs = await enrichPrograms(programIds, accountMap, connection, policy);
  const shouldSkipConcentration =
    programs.every((program) => program.allowlisted) && mintIds.every((mint) => Boolean(VERIFIED_SAFE_MINTS[mint]));
  const mints = await enrichMints(mintIds, connection, shouldSkipConcentration);

  return {
    ran: true,
    unknownChecks: [],
    mints,
    programs
  };
}

async function enrichPrograms(
  programIds: string[],
  accountMap: Map<string, AccountInfo<Buffer> | null>,
  connection: Connection,
  policy: PolicyConfig
): Promise<ProgramRisk[]> {
  const programDataToProgram = new Map<string, string>();
  const risks: ProgramRisk[] = [];

  for (const programId of programIds) {
    const cacheKey = programCacheKey(programId, policy);
    const cached = programCache.get(cacheKey);
    if (cached) {
      risks.push(cached);
      continue;
    }
    const base = programRisk(programId, policy.programs.allow);
    const info = accountMap.get(programId) ?? null;
    if (!info || base.allowlisted) {
      risks.push(base);
      continue;
    }
    if (info.owner.toBase58() === PROGRAMS.bpfUpgradeable && info.data.length >= 36) {
      const tag = info.data.readUInt32LE(0);
      if (tag === 2) {
        const programData = new PublicKey(info.data.slice(4, 36)).toBase58();
        programDataToProgram.set(programData, programId);
        risks.push({ ...base, upgradeable: true });
        continue;
      }
    }
    risks.push({ ...base, upgradeable: false });
  }

  if (programDataToProgram.size === 0) {
    risks.forEach((risk) => programCache.set(programCacheKey(risk.programId, policy), risk));
    return risks;
  }

  const programDataMap = await getMultipleAccountsMap(connection, [...programDataToProgram.keys()]);
  return risks.map((risk) => {
    const programDataAddress = [...programDataToProgram.entries()].find(([, programId]) => programId === risk.programId)?.[0];
    if (!programDataAddress) {
      programCache.set(programCacheKey(risk.programId, policy), risk);
      return risk;
    }
    const info = programDataMap.get(programDataAddress) ?? null;
    const upgradeAuthority = parseProgramDataAuthority(info);
    const enriched = { ...risk, upgradeable: true, upgradeAuthority };
    programCache.set(programCacheKey(risk.programId, policy), enriched);
    return enriched;
  });
}

async function enrichMints(mintIds: string[], connection: Connection, skipConcentration: boolean): Promise<MintRisk[]> {
  const uncached = mintIds.filter((mint) => !mintCache.get(mint));
  const mintAccountMap =
    uncached.length > 0 ? await getMultipleAccountsMap(connection, uncached) : new Map<string, AccountInfo<Buffer> | null>();
  const risks: MintRisk[] = [];

  for (const mint of mintIds) {
    const cached = mintCache.get(mint);
    if (cached) {
      risks.push(cached);
      continue;
    }

    const info = mintAccountMap.get(mint) ?? null;
    const base = parseMintBase(info);
    const ownerProgram = info?.owner.toBase58() ?? "unknown";
    const extensions = decodeMintExtensions(mint, info);
    const risk: MintRisk = {
      mint,
      ownerProgram,
      decimals: base?.decimals,
      mintAuthority: base?.mintAuthority,
      freezeAuthority: base?.freezeAuthority,
      extensions,
      concentration: skipConcentration ? { checked: false, note: "Skipped for verified-safe mint fast path." } : undefined
    };

    if (!skipConcentration && !VERIFIED_SAFE_MINTS[mint]) {
      risk.concentration = await checkConcentration(connection, mint);
    }

    mintCache.set(mint, risk);
    risks.push(risk);
  }

  return risks;
}

function decodeMintExtensions(mint: string, info: AccountInfo<Buffer> | null): string[] {
  if (!info || info.owner.toBase58() !== PROGRAMS.token2022) {
    return [];
  }
  try {
    const unpacked = unpackMint(new PublicKey(mint), info, new PublicKey(PROGRAMS.token2022));
    return getExtensionTypes(unpacked.tlvData).map((extension) => extensionTypeName(Number(extension)));
  } catch {
    return [];
  }
}

async function checkConcentration(
  connection: Connection,
  mint: string
): Promise<NonNullable<MintRisk["concentration"]>> {
  try {
    const [largest, supply] = await Promise.all([
      connection.getTokenLargestAccounts(new PublicKey(mint)),
      connection.getTokenSupply(new PublicKey(mint))
    ]);
    const candidates = largest.value.filter((holder) => !KNOWN_INFRA_OR_POOL_ACCOUNTS.has(holder.address.toBase58()));
    const largestNonInfra = candidates[0];
    const supplyRaw = BigInt(supply.value.amount);
    const largestRaw = largestNonInfra ? BigInt(largestNonInfra.amount) : 0n;
    const percent =
      supplyRaw > 0n && largestRaw > 0n ? Number((largestRaw * 10_000n) / supplyRaw) / 100 : undefined;
    return {
      checked: true,
      largestNonInfraPercent: percent,
      note: "Largest-account value is token-account-level only; use as weak context, never sole BLOCK."
    };
  } catch (error) {
    return {
      checked: false,
      note: `Concentration check failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function programCacheKey(programId: string, policy: PolicyConfig): string {
  return `${programId}:${policy.programs.allow.join(",")}`;
}

function parseProgramDataAuthority(info: AccountInfo<Buffer> | null): string | null | undefined {
  if (!info || info.data.length < 48) {
    return undefined;
  }
  const tag = info.data.readUInt32LE(0);
  if (tag !== 3) {
    return undefined;
  }
  const option = info.data.readUInt32LE(12);
  if (option !== 1) {
    return null;
  }
  return new PublicKey(info.data.slice(16, 48)).toBase58();
}

export function enrichmentFindings(enrich: EnrichmentResult, policy: PolicyConfig): import("./types.js").Finding[] {
  const findings: import("./types.js").Finding[] = [];
  for (const mint of enrich.mints) {
    if (mint.mintAuthority) {
      findings.push({
        id: "MINT_AUTHORITY_LIVE",
        severity: "LOW",
        detail: `Mint ${mint.mint} still has live mint authority.`,
        evidence: { mint: mint.mint, mintAuthority: mint.mintAuthority }
      });
    }
    if (mint.freezeAuthority || mint.extensions.includes("DefaultAccountState")) {
      findings.push({
        id: "T22_FREEZE_RISK",
        severity: policy.tokens.denyLiveFreezeAuthority ? "CRITICAL" : "MEDIUM",
        detail: `Mint ${mint.mint} has freeze/default-state risk.`,
        evidence: { mint: mint.mint, freezeAuthority: mint.freezeAuthority, extensions: mint.extensions }
      });
    }
    if (mint.extensions.includes("PermanentDelegate")) {
      findings.push({
        id: "T22_PERMANENT_DELEGATE",
        severity: policy.tokens.denyPermanentDelegate ? "CRITICAL" : "HIGH",
        detail: `Token-2022 mint ${mint.mint} has PermanentDelegate enabled.`,
        evidence: { mint: mint.mint, extensions: mint.extensions }
      });
    }
    if (mint.extensions.includes("TransferHook")) {
      const severity = policy.tokens.transferHook === "deny" ? "CRITICAL" : "HIGH";
      findings.push({
        id: "T22_TRANSFER_HOOK",
        severity,
        detail: `Token-2022 mint ${mint.mint} has a transfer hook.`,
        evidence: { mint: mint.mint, extensions: mint.extensions }
      });
    }
    if (mint.extensions.includes("TransferFeeConfig")) {
      findings.push({
        id: "T22_TRANSFER_FEE",
        severity: "INFO",
        detail: `Token-2022 mint ${mint.mint} has transfer-fee config; token deltas may be fee-adjusted by runtime state.`,
        evidence: { mint: mint.mint, extensions: mint.extensions }
      });
    }
    if (mint.concentration?.checked && (mint.concentration.largestNonInfraPercent ?? 0) > 60) {
      findings.push({
        id: "HOLDER_CONCENTRATION",
        severity: "INFO",
        detail: `Mint ${mint.mint} has a large non-infra token account concentration signal.`,
        evidence: { mint: mint.mint, concentration: mint.concentration }
      });
    }
  }

  for (const program of enrich.programs) {
    if (!program.allowlisted && program.upgradeable && program.upgradeAuthority) {
      findings.push({
        id: "UNKNOWN_PROGRAM_CPI",
        severity: "HIGH",
        detail: `Unknown program ${program.programId} is upgradeable and still has an upgrade authority.`,
        evidence: { programId: program.programId, upgradeAuthority: program.upgradeAuthority }
      });
    }
  }

  if (!enrich.ran) {
    findings.push({
      id: "RPC_UNAVAILABLE",
      severity: "HIGH",
      detail: "RPC enrichment did not run; mint, Token-2022, program authority, and concentration checks are unknown.",
      evidence: { unknownChecks: enrich.unknownChecks }
    });
  }

  return findings;
}
