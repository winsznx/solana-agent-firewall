import type { ProgramRisk } from "./types.js";

export const PROGRAMS = {
  system: "11111111111111111111111111111111",
  token: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  token2022: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnB5nVZV9cE5",
  associatedToken: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  computeBudget: "ComputeBudget111111111111111111111111111111",
  bpfUpgradeable: "BPFLoaderUpgradeab1e11111111111111111111111",
  memo: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  memoV2: "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
  jupiterV6: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  jupiterLimit: "jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu",
  orcaWhirlpool: "whirLbMiicVdio4qvUfM5KAg6CtXcff9V8iaJ3fK5h",
  raydiumAmmV4: "675kPX9MHTjS2zt1qfr1NYtD4xuxy7E2vYJxV9Gf6eL",
  raydiumClmm: "CAMMCzo5YL8w4VFF8KVHrK22GGUQjqWzFX7gWvrgiKqu",
  meteoraDlmm: "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  squadsV4: "SMPLecH534NA9acpos4G6ZqD9WHkCLsyLtnwjH8R7x7",
  metaplexTokenMetadata: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
} as const;

export const BUILT_IN_ALLOWLIST: Record<string, string> = {
  [PROGRAMS.system]: "System Program",
  [PROGRAMS.token]: "SPL Token",
  [PROGRAMS.token2022]: "Token-2022",
  [PROGRAMS.associatedToken]: "Associated Token Account",
  [PROGRAMS.computeBudget]: "Compute Budget",
  [PROGRAMS.memo]: "Memo",
  [PROGRAMS.memoV2]: "Memo v2",
  [PROGRAMS.jupiterV6]: "Jupiter Aggregator v6",
  [PROGRAMS.jupiterLimit]: "Jupiter Limit Order",
  [PROGRAMS.orcaWhirlpool]: "Orca Whirlpools",
  [PROGRAMS.raydiumAmmV4]: "Raydium AMM v4",
  [PROGRAMS.raydiumClmm]: "Raydium CLMM",
  [PROGRAMS.meteoraDlmm]: "Meteora DLMM",
  [PROGRAMS.squadsV4]: "Squads v4",
  [PROGRAMS.metaplexTokenMetadata]: "Metaplex Token Metadata"
};

export const VERIFIED_SAFE_MINTS: Record<string, string> = {
  So11111111111111111111111111111111111111112: "Wrapped SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoRNC7jPx7gB4a7Yf4V: "USDT",
  "2b1kV6DUNF9rWrnZsG3Cja3FqDvaTcYSei9RvJ6hXz7N": "USDG"
};

export const KNOWN_INFRA_OR_POOL_ACCOUNTS = new Set<string>([
  "11111111111111111111111111111111",
  PROGRAMS.jupiterV6,
  PROGRAMS.orcaWhirlpool,
  PROGRAMS.raydiumAmmV4,
  PROGRAMS.raydiumClmm,
  PROGRAMS.meteoraDlmm
]);

export function programLabel(programId: string, extraAllowlist: string[] = []): string {
  if (BUILT_IN_ALLOWLIST[programId]) {
    return BUILT_IN_ALLOWLIST[programId];
  }
  if (extraAllowlist.includes(programId)) {
    return "Policy Allowlist Program";
  }
  return "Unknown Program";
}

export function isProgramAllowlisted(programId: string, extraAllowlist: string[] = []): boolean {
  return Boolean(BUILT_IN_ALLOWLIST[programId]) || extraAllowlist.includes(programId);
}

export function programRisk(programId: string, extraAllowlist: string[] = []): ProgramRisk {
  return {
    programId,
    label: programLabel(programId, extraAllowlist),
    allowlisted: isProgramAllowlisted(programId, extraAllowlist)
  };
}

export function isSquadsOwned(owner?: string | null): boolean {
  return owner === PROGRAMS.squadsV4;
}
