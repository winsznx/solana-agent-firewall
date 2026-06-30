import { PublicKey } from "@solana/web3.js";

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const U64_MAX = (1n << 64n) - 1n;

export function readU64LE(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}

export function readU32LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  return view.getUint32(0, true);
}

export function readPubkey(data: Uint8Array, offset: number): string {
  return new PublicKey(data.slice(offset, offset + 32)).toBase58();
}

export function lamportsToSolString(lamports: number): string {
  const sign = lamports > 0 ? "+" : lamports < 0 ? "-" : "";
  const absolute = Math.abs(lamports) / LAMPORTS_PER_SOL;
  return `${sign}${absolute.toLocaleString("en-US", {
    maximumFractionDigits: 9,
    minimumFractionDigits: absolute === 0 ? 0 : 1
  })} SOL`;
}

export function shorten(pubkey: string): string {
  if (pubkey.length <= 12) {
    return pubkey;
  }
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function asBase64(input: string): string {
  return input.trim().replace(/^base64:/, "");
}

export function bigintDeltaToString(delta: bigint, decimals?: number): string {
  const sign = delta > 0n ? "+" : delta < 0n ? "-" : "";
  const absolute = delta < 0n ? -delta : delta;
  if (decimals === undefined || decimals <= 0) {
    return `${sign}${absolute.toString()}`;
  }
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${sign}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

export function parseJsonObject<T>(value: string): T {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as T;
}
