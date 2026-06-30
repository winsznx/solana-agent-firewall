import { PublicKey, type AccountInfo, type Connection, type SimulatedTransactionAccountInfo, type VersionedTransaction } from "@solana/web3.js";
import { parseTokenAccountInfo } from "./account-decode.js";
import { getMultipleAccountsMap } from "./rpc.js";
import type { SimulationResult, TransactionContext } from "./types.js";
import { bigintDeltaToString, lamportsToSolString, unique } from "./utils.js";

export async function simulateAndDiff(
  transaction: VersionedTransaction,
  context: TransactionContext,
  connection: Connection | undefined
): Promise<SimulationResult> {
  if (!connection) {
    return {
      ran: false,
      success: false,
      err: "No RPC URL configured",
      logsTail: [],
      solDeltaLamports: 0,
      solDelta: "0 SOL",
      tokenDeltas: []
    };
  }

  const addresses = unique([...context.signerKeys, ...context.writableKeys]).slice(0, 100);
  try {
    const preAccounts = await getMultipleAccountsMap(connection, addresses);
    const result = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      accounts: {
        encoding: "base64",
        addresses
      }
    });
    const postAccounts = new Map(
      addresses.map((address, index) => [address, simAccountToAccountInfo(result.value.accounts?.[index] ?? null)])
    );

    const solDeltaLamports = context.signerKeys.reduce((sum, signer) => {
      const pre = preAccounts.get(signer)?.lamports ?? 0;
      const post = postAccounts.get(signer)?.lamports ?? pre;
      return sum + (post - pre);
    }, 0);

    return {
      ran: true,
      success: !result.value.err,
      err: result.value.err,
      computeUnits: result.value.unitsConsumed,
      logsTail: (result.value.logs ?? []).slice(-8),
      solDeltaLamports,
      solDelta: lamportsToSolString(solDeltaLamports),
      tokenDeltas: tokenDeltas(addresses, preAccounts, postAccounts, context.signerKeys)
    };
  } catch (error) {
    return {
      ran: false,
      success: false,
      err: error instanceof Error ? error.message : String(error),
      logsTail: [],
      solDeltaLamports: 0,
      solDelta: "0 SOL",
      tokenDeltas: []
    };
  }
}

function tokenDeltas(
  addresses: string[],
  preAccounts: Map<string, AccountInfo<Buffer> | null>,
  postAccounts: Map<string, AccountInfo<Buffer> | null>,
  signerKeys: string[]
): SimulationResult["tokenDeltas"] {
  const deltas: SimulationResult["tokenDeltas"] = [];
  for (const address of addresses) {
    const pre = parseTokenAccountInfo(preAccounts.get(address) ?? null);
    const post = parseTokenAccountInfo(postAccounts.get(address) ?? null);
    const owner = post?.owner ?? pre?.owner;
    if (!owner || !signerKeys.includes(owner)) {
      continue;
    }
    const preAmount = pre?.amount ?? 0n;
    const postAmount = post?.amount ?? preAmount;
    const delta = postAmount - preAmount;
    if (delta === 0n) {
      continue;
    }
    deltas.push({
      account: address,
      mint: post?.mint ?? pre?.mint,
      owner,
      deltaRaw: delta.toString(),
      deltaUi: bigintDeltaToString(delta),
      program: post?.program ?? pre?.program
    });
  }
  return deltas;
}

function simAccountToAccountInfo(account: SimulatedTransactionAccountInfo | null): AccountInfo<Buffer> | null {
  if (!account) {
    return null;
  }
  const rawData = Array.isArray(account.data) ? account.data[0] : account.data;
  return {
    data: Buffer.from(rawData ?? "", "base64"),
    executable: account.executable,
    lamports: account.lamports,
    owner: new PublicKey(account.owner),
    rentEpoch: account.rentEpoch
  };
}
