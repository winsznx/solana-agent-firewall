import { Connection, PublicKey, type AccountInfo } from "@solana/web3.js";

export const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

export function makeConnection(rpcUrl?: string): Connection | undefined {
  const endpoint = rpcUrl || process.env.SOLANA_RPC_URL;
  if (!endpoint) {
    return undefined;
  }
  return new Connection(endpoint, "confirmed");
}

export class TtlCache<T> {
  private readonly values = new Map<string, { expiresAt: number; value: T }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const found = this.values.get(key);
    if (!found) {
      return undefined;
    }
    if (Date.now() > found.expiresAt) {
      this.values.delete(key);
      return undefined;
    }
    return found.value;
  }

  set(key: string, value: T): void {
    this.values.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

export async function getMultipleAccountsMap(
  connection: Connection,
  addresses: string[]
): Promise<Map<string, AccountInfo<Buffer> | null>> {
  const uniqueAddresses = [...new Set(addresses)];
  const pubkeys = uniqueAddresses.map((address) => new PublicKey(address));
  const infos = await connection.getMultipleAccountsInfo(pubkeys);
  return new Map(uniqueAddresses.map((address, index) => [address, infos[index] ?? null]));
}
