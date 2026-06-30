import {
  AddressLookupTableAccount,
  type Connection,
  PublicKey,
  VersionedTransaction
} from "@solana/web3.js";
import { decodeCompiledInstruction } from "./decoders/index.js";
import type { AccountMetaView, DecodedInstruction, Finding, TransactionContext } from "./types.js";
import { asBase64, unique } from "./utils.js";

export interface IngestedTransaction {
  transaction: VersionedTransaction;
  context: TransactionContext;
  preflightFindings: Finding[];
}

export async function ingestTransaction(
  serializedTx: string,
  connection: Connection | undefined,
  policyAllowlist: string[] = []
): Promise<IngestedTransaction> {
  let transaction: VersionedTransaction;
  try {
    transaction = VersionedTransaction.deserialize(Buffer.from(asBase64(serializedTx), "base64"));
  } catch (error) {
    throw new Error(`Unable to deserialize transaction: ${error instanceof Error ? error.message : String(error)}`);
  }

  const message = transaction.message as any;
  const lookups = message.addressTableLookups ?? [];
  const { lookupAccounts, altResolved, lookupTableAddresses, altNotes } = await resolveAddressLookupTables(connection, lookups);
  const fullKeys = getFullAccountKeys(message, lookupAccounts);
  const header = message.header;
  const compiledInstructions = message.compiledInstructions ?? message.instructions ?? [];
  const accountViews = fullKeys.map((pubkey, index) => ({
    pubkey: pubkey.toBase58(),
    isSigner: isSigner(message, index, header),
    isWritable: isWritable(message, index, header, fullKeys.length)
  }));

  const decodedInstructions: DecodedInstruction[] = compiledInstructions.map((instruction: any, index: number) => {
    const programIndex = instruction.programIdIndex;
    const accountIndexes: number[] = instruction.accountKeyIndexes ?? instruction.accounts ?? [];
    const programId = fullKeys[programIndex]?.toBase58() ?? `unresolved:${programIndex}`;
    const accounts: AccountMetaView[] = accountIndexes.map((accountIndex) => {
      const fallback = `unresolved:${accountIndex}`;
      const account = accountViews[accountIndex];
      return account ?? { pubkey: fallback, isSigner: false, isWritable: false };
    });
    return decodeCompiledInstruction(index, programId, accounts, Buffer.from(instruction.data), policyAllowlist);
  });

  const unknownPrograms: string[] = unique(
    decodedInstructions.filter((instruction) => !instruction.decoded).map((instruction) => instruction.programId)
  );
  const preflightFindings: Finding[] = [];
  if (!altResolved) {
    preflightFindings.push({
      id: "ALT_UNRESOLVED",
      severity: "HIGH",
      detail: "One or more address lookup tables could not be resolved; account attribution is incomplete.",
      evidence: { lookupTableAddresses }
    });
  }

  const context: TransactionContext = {
    serialized: asBase64(serializedTx),
    version: String((transaction as any).version ?? message.version ?? "legacy"),
    feePayer: fullKeys[0]?.toBase58() ?? "unknown",
    instructionCount: decodedInstructions.length,
    altResolved,
    alreadySigned: transaction.signatures.some((signature) => signature.some((byte) => byte !== 0)),
    accountKeys: accountViews,
    decodedInstructions,
    lookupTableAddresses,
    signerKeys: accountViews.filter((account) => account.isSigner).map((account) => account.pubkey),
    writableKeys: accountViews.filter((account) => account.isWritable).map((account) => account.pubkey),
    unknownPrograms,
    notes: [
      ...altNotes,
      ...(transaction.signatures.some((signature) => signature.some((byte) => byte !== 0))
        ? ["Transaction already contains at least one non-zero signature; continuing inspection."]
        : [])
    ]
  };

  return { transaction, context, preflightFindings };
}

async function resolveAddressLookupTables(
  connection: Connection | undefined,
  lookups: Array<{ accountKey: PublicKey }>
): Promise<{
  lookupAccounts: AddressLookupTableAccount[];
  altResolved: boolean;
  lookupTableAddresses: string[];
  altNotes: string[];
}> {
  if (lookups.length === 0) {
    return { lookupAccounts: [], altResolved: true, lookupTableAddresses: [], altNotes: [] };
  }
  const lookupTableAddresses = lookups.map((lookup) => lookup.accountKey.toBase58());
  if (!connection) {
    return {
      lookupAccounts: [],
      altResolved: false,
      lookupTableAddresses,
      altNotes: ["No RPC URL was available to resolve address lookup tables."]
    };
  }

  let infos: Awaited<ReturnType<Connection["getMultipleAccountsInfo"]>>;
  try {
    infos = await connection.getMultipleAccountsInfo(lookups.map((lookup) => lookup.accountKey));
  } catch (error) {
    return {
      lookupAccounts: [],
      altResolved: false,
      lookupTableAddresses,
      altNotes: [
        `Failed to fetch address lookup tables: ${error instanceof Error ? error.message : String(error)}`
      ]
    };
  }
  const lookupAccounts: AddressLookupTableAccount[] = [];
  const missing: string[] = [];
  for (const [index, info] of infos.entries()) {
    const lookup = lookups[index];
    if (!info || !lookup) {
      missing.push(lookup?.accountKey.toBase58() ?? `lookup:${index}`);
      continue;
    }
    try {
      lookupAccounts.push(
        new AddressLookupTableAccount({
          key: lookup.accountKey,
          state: AddressLookupTableAccount.deserialize(info.data)
        })
      );
    } catch {
      missing.push(lookup.accountKey.toBase58());
    }
  }

  return {
    lookupAccounts,
    altResolved: missing.length === 0,
    lookupTableAddresses,
    altNotes: missing.length > 0 ? [`Failed to resolve lookup tables: ${missing.join(", ")}`] : []
  };
}

function getFullAccountKeys(message: any, lookupAccounts: AddressLookupTableAccount[]): PublicKey[] {
  try {
    const accountKeys = message.getAccountKeys({ addressLookupTableAccounts: lookupAccounts });
    const lookupWritable = accountKeys.accountKeysFromLookups?.writable ?? [];
    const lookupReadonly = accountKeys.accountKeysFromLookups?.readonly ?? [];
    return [...accountKeys.staticAccountKeys, ...lookupWritable, ...lookupReadonly];
  } catch {
    return message.staticAccountKeys ?? message.accountKeys ?? [];
  }
}

function isSigner(message: any, index: number, header: any): boolean {
  if (typeof message.isAccountSigner === "function") {
    return Boolean(message.isAccountSigner(index));
  }
  return index < (header?.numRequiredSignatures ?? 0);
}

function isWritable(message: any, index: number, header: any, keyCount: number): boolean {
  if (typeof message.isAccountWritable === "function") {
    try {
      return Boolean(message.isAccountWritable(index));
    } catch {
      // Fall through to the legacy header calculation.
    }
  }
  const requiredSignatures = header?.numRequiredSignatures ?? 0;
  const readonlySigned = header?.numReadonlySignedAccounts ?? 0;
  const readonlyUnsigned = header?.numReadonlyUnsignedAccounts ?? 0;
  if (index < requiredSignatures) {
    return index < requiredSignatures - readonlySigned;
  }
  return index < keyCount - readonlyUnsigned;
}
