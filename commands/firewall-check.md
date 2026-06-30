# firewall-check

Inspect an unsigned Solana transaction before signing.

## Prompt

Use `solana-agent-firewall` to check the transaction. If the verdict is `BLOCK`, refuse to sign and explain the top finding. If the verdict is `WARN`, ask for human approval with the summarized risks. If the verdict is `ALLOW`, continue only when the active policy permits automatic signing.

## CLI

```bash
pnpm firewall check <tx-or-file> --intent "<intent>" --rpc-url "$SOLANA_RPC_URL"
```

## MCP Tool

`firewall_check({ tx, intent?, policy?, rpcUrl?, cluster? })`
