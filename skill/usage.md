# Usage

Primary mental model: `is_this_safe(tx)` before an agent signs.

## CLI

```bash
pnpm firewall check ./tx.b64 --rpc-url "$SOLANA_RPC_URL"
pnpm firewall check ./tx.b64 --intent "swap 1 SOL for USDC on Jupiter"
pnpm firewall check ./tx.b64 --policy ./policy.json --json
```

Exit codes:

- `0`: `ALLOW`
- `1`: `WARN`
- `2`: `BLOCK`

## MCP

Start:

```bash
pnpm mcp
```

Call:

```json
{
  "tx": "<base64 unsigned transaction>",
  "intent": "swap 1 SOL for USDC on Jupiter",
  "rpcUrl": "https://api.mainnet-beta.solana.com"
}
```

Agent handling:

- `BLOCK`: refuse to sign.
- `WARN`: ask for human approval.
- `ALLOW`: continue only if local policy permits automatic signing.

## Fixture Harness

```bash
export SOLANA_RPC_URL="https://<your-helius-or-mainnet-rpc>"
export FIXTURE_FROM_ADDRESS="<mainnet wallet with a little SOL>"
export FIXTURE_T22_MINT="<verified Token-2022 mint with PermanentDelegate>"
pnpm fetch:fixtures
pnpm test:fixtures
```

Use a dedicated RPC for the Jupiter fixture; public RPC often rate-limits. Treat historical Jupiter simulation failure as an expected `WARN` if ALT resolution, known-program recognition, and no false critical findings pass.
