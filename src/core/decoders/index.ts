import type { AccountMetaView, DecodedInstruction } from "../types.js";
import { PROGRAMS, programLabel } from "../allowlist.js";
import { readPubkey, readU32LE, readU64LE } from "../utils.js";

const TOKEN_AUTHORITY_TYPES: Record<number, string> = {
  0: "MintTokens",
  1: "FreezeAccount",
  2: "AccountOwner",
  3: "CloseAccount"
};

const SYSTEM_INSTRUCTIONS: Record<number, string> = {
  0: "CreateAccount",
  1: "Assign",
  2: "Transfer",
  3: "CreateAccountWithSeed",
  8: "Allocate",
  9: "AllocateWithSeed",
  10: "AssignWithSeed",
  11: "TransferWithSeed"
};

const BPF_UPGRADEABLE_INSTRUCTIONS: Record<number, string> = {
  0: "InitializeBuffer",
  1: "Write",
  2: "DeployWithMaxDataLen",
  3: "Upgrade",
  4: "SetAuthority",
  5: "Close",
  6: "ExtendProgram",
  7: "SetAuthorityChecked"
};

export function decodeCompiledInstruction(
  index: number,
  programId: string,
  accounts: AccountMetaView[],
  data: Uint8Array,
  policyAllowlist: string[] = []
): DecodedInstruction {
  const base = {
    index,
    programId,
    programName: programLabel(programId, policyAllowlist),
    accounts,
    dataBase64: Buffer.from(data).toString("base64")
  };

  if (programId === PROGRAMS.system) {
    return { ...base, ...decodeSystem(data, accounts) };
  }
  if (programId === PROGRAMS.computeBudget) {
    return { ...base, ...decodeComputeBudget(data) };
  }
  if (programId === PROGRAMS.token || programId === PROGRAMS.token2022) {
    return { ...base, ...decodeToken(data, accounts, programId) };
  }
  if (programId === PROGRAMS.associatedToken) {
    return { ...base, decoded: true, name: decodeAssociatedToken(data) };
  }
  if (programId === PROGRAMS.bpfUpgradeable) {
    return { ...base, ...decodeBpfUpgradeable(data, accounts) };
  }
  if (programLabel(programId, policyAllowlist) !== "Unknown Program") {
    return { ...base, decoded: true, name: "KnownProtocolInstruction" };
  }
  return { ...base, decoded: false };
}

function decodeSystem(data: Uint8Array, accounts: AccountMetaView[]): Pick<DecodedInstruction, "decoded" | "name" | "params"> {
  if (data.length < 4) {
    return { decoded: false };
  }
  const type = readU32LE(data, 0);
  const name = SYSTEM_INSTRUCTIONS[type] ?? `SystemInstruction${type}`;
  const params: Record<string, unknown> = {};
  if (name === "Transfer" && data.length >= 12) {
    params.lamports = readU64LE(data, 4).toString();
    params.from = accounts[0]?.pubkey;
    params.to = accounts[1]?.pubkey;
  }
  return { decoded: true, name, params };
}

function decodeComputeBudget(data: Uint8Array): Pick<DecodedInstruction, "decoded" | "name" | "params"> {
  const tag = data[0];
  if (tag === 2 && data.length >= 5) {
    return { decoded: true, name: "SetComputeUnitLimit", params: { units: readU32LE(data, 1) } };
  }
  if (tag === 3 && data.length >= 9) {
    return { decoded: true, name: "SetComputeUnitPrice", params: { microLamports: readU64LE(data, 1).toString() } };
  }
  if (tag === 0) {
    return { decoded: true, name: "RequestUnitsDeprecated" };
  }
  if (tag === 1) {
    return { decoded: true, name: "RequestHeapFrame" };
  }
  return { decoded: true, name: `ComputeBudgetInstruction${tag}` };
}

function decodeAssociatedToken(data: Uint8Array): string {
  if (data.length === 0) {
    return "Create";
  }
  if (data[0] === 1) {
    return "CreateIdempotent";
  }
  if (data[0] === 2) {
    return "RecoverNested";
  }
  return `AssociatedTokenInstruction${data[0]}`;
}

function decodeToken(
  data: Uint8Array,
  accounts: AccountMetaView[],
  programId: string
): Pick<DecodedInstruction, "decoded" | "name" | "params"> {
  const tag = data[0];
  const params: Record<string, unknown> = { tokenProgram: programId === PROGRAMS.token2022 ? "token-2022" : "spl-token" };

  if (tag === 3 && data.length >= 9) {
    params.amount = readU64LE(data, 1).toString();
    params.source = accounts[0]?.pubkey;
    params.destination = accounts[1]?.pubkey;
    params.owner = accounts[2]?.pubkey;
    return { decoded: true, name: "Transfer", params };
  }

  if (tag === 4 && data.length >= 9) {
    params.amount = readU64LE(data, 1).toString();
    params.source = accounts[0]?.pubkey;
    params.delegate = accounts[1]?.pubkey;
    params.owner = accounts[2]?.pubkey;
    return { decoded: true, name: "Approve", params };
  }

  if (tag === 6 && data.length >= 3) {
    const authorityType = data[1] ?? 255;
    const option = data[2] ?? 0;
    params.authorityType = TOKEN_AUTHORITY_TYPES[authorityType] ?? `AuthorityType${authorityType}`;
    params.currentAuthority = accounts[1]?.pubkey;
    params.target = accounts[0]?.pubkey;
    params.newAuthority = option === 1 && data.length >= 35 ? readPubkey(data, 3) : null;
    return { decoded: true, name: "SetAuthority", params };
  }

  if (tag === 8 && data.length >= 9) {
    params.amount = readU64LE(data, 1).toString();
    params.account = accounts[0]?.pubkey;
    params.mint = accounts[1]?.pubkey;
    params.owner = accounts[2]?.pubkey;
    return { decoded: true, name: "Burn", params };
  }

  if (tag === 9) {
    params.account = accounts[0]?.pubkey;
    params.destination = accounts[1]?.pubkey;
    params.authority = accounts[2]?.pubkey;
    return { decoded: true, name: "CloseAccount", params };
  }

  if (tag === 12 && data.length >= 10) {
    params.amount = readU64LE(data, 1).toString();
    params.decimals = data[9];
    params.source = accounts[0]?.pubkey;
    params.mint = accounts[1]?.pubkey;
    params.destination = accounts[2]?.pubkey;
    params.owner = accounts[3]?.pubkey;
    return { decoded: true, name: "TransferChecked", params };
  }

  if (tag === 13 && data.length >= 10) {
    params.amount = readU64LE(data, 1).toString();
    params.decimals = data[9];
    params.source = accounts[0]?.pubkey;
    params.mint = accounts[1]?.pubkey;
    params.delegate = accounts[2]?.pubkey;
    params.owner = accounts[3]?.pubkey;
    return { decoded: true, name: "ApproveChecked", params };
  }

  if (tag === 15 && data.length >= 10) {
    params.amount = readU64LE(data, 1).toString();
    params.decimals = data[9];
    params.account = accounts[0]?.pubkey;
    params.mint = accounts[1]?.pubkey;
    params.owner = accounts[2]?.pubkey;
    return { decoded: true, name: "BurnChecked", params };
  }

  return { decoded: true, name: `TokenInstruction${tag}`, params };
}

function decodeBpfUpgradeable(
  data: Uint8Array,
  accounts: AccountMetaView[]
): Pick<DecodedInstruction, "decoded" | "name" | "params"> {
  if (data.length < 4) {
    return { decoded: false };
  }
  const type = readU32LE(data, 0);
  const name = BPF_UPGRADEABLE_INSTRUCTIONS[type] ?? `BpfUpgradeableInstruction${type}`;
  return {
    decoded: true,
    name,
    params: {
      programData: accounts[0]?.pubkey,
      program: accounts[1]?.pubkey,
      authority: accounts.at(-1)?.pubkey
    }
  };
}
