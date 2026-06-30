import type { AccountInfo } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { PROGRAMS } from "./allowlist.js";
import { readPubkey, readU32LE, readU64LE } from "./utils.js";

export interface ParsedTokenAccount {
  mint: string;
  owner: string;
  amount: bigint;
  program: "spl-token" | "token-2022";
}

export interface ParsedMintBase {
  mintAuthority: string | null;
  supply: bigint;
  decimals: number;
  freezeAuthority: string | null;
}

export function parseTokenAccountInfo(info: AccountInfo<Buffer> | null): ParsedTokenAccount | undefined {
  if (!info || info.data.length < 72) {
    return undefined;
  }
  const ownerProgram = info.owner.toBase58();
  if (ownerProgram !== PROGRAMS.token && ownerProgram !== PROGRAMS.token2022) {
    return undefined;
  }
  return {
    mint: readPubkey(info.data, 0),
    owner: readPubkey(info.data, 32),
    amount: readU64LE(info.data, 64),
    program: ownerProgram === PROGRAMS.token2022 ? "token-2022" : "spl-token"
  };
}

export function parseMintBase(info: AccountInfo<Buffer> | null): ParsedMintBase | undefined {
  if (!info || info.data.length < 82) {
    return undefined;
  }
  const ownerProgram = info.owner.toBase58();
  if (ownerProgram !== PROGRAMS.token && ownerProgram !== PROGRAMS.token2022) {
    return undefined;
  }
  const mintAuthorityOption = readU32LE(info.data, 0);
  const freezeAuthorityOption = readU32LE(info.data, 46);
  return {
    mintAuthority: mintAuthorityOption === 1 ? new PublicKey(info.data.slice(4, 36)).toBase58() : null,
    supply: readU64LE(info.data, 36),
    decimals: info.data[44] ?? 0,
    freezeAuthority: freezeAuthorityOption === 1 ? new PublicKey(info.data.slice(50, 82)).toBase58() : null
  };
}

export function extensionTypeName(type: number): string {
  const known: Record<number, string> = {
    1: "TransferFeeConfig",
    2: "TransferFeeAmount",
    3: "MintCloseAuthority",
    4: "ConfidentialTransferMint",
    5: "ConfidentialTransferAccount",
    6: "DefaultAccountState",
    7: "ImmutableOwner",
    8: "MemoTransfer",
    9: "NonTransferable",
    10: "InterestBearingConfig",
    11: "CpiGuard",
    12: "PermanentDelegate",
    13: "NonTransferableAccount",
    14: "TransferHook",
    15: "TransferHookAccount",
    16: "MetadataPointer",
    17: "TokenMetadata",
    18: "GroupPointer",
    19: "TokenGroup",
    20: "GroupMemberPointer",
    21: "TokenGroupMember",
    22: "ConfidentialTransferFeeConfig",
    23: "ConfidentialTransferFeeAmount"
  };
  return known[type] ?? `ExtensionType${type}`;
}
