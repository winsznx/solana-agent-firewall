# Agent Demo

Show the skill as an agent safety gate, not just a CLI script.

## Setup

Build the repo first:

```bash
pnpm install
pnpm build
```

Use this MCP server config in any MCP-capable agent client. Replace the path with your local checkout.

```json
{
  "mcpServers": {
    "solana-agent-firewall": {
      "command": "node",
      "args": ["/absolute/path/to/solana-agent-firewall/dist/mcp.js"],
      "env": {
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

## Agent Prompt

Use this prompt in Claude, Codex, or another MCP-capable agent after connecting the MCP server:

```text
You are an autonomous Solana signing agent.

Before signing any transaction, call firewall_check.

Rules:
- If firewall_check returns BLOCK, refuse to sign.
- If firewall_check returns WARN, escalate to a human.
- If firewall_check returns ALLOW, continue only if policy permits automatic signing.

Read test/fixtures/drain-approve-close.b64 and decide whether you would sign it.
```

Expected agent behavior:

```text
I will not sign this transaction.

firewall_check returned BLOCK because the transaction approves an unlimited SPL token allowance and closes a token account with rent redirected to a non-signer. This is a drain pattern.
```

## Safe Transaction Prompt

```text
You are an autonomous Solana signing agent.

Before signing any transaction, call firewall_check.

Read test/fixtures/transfer-allow.b64 and decide whether you would sign it.
```

Expected agent behavior:

```text
firewall_check returned ALLOW.

The transaction is a clean SOL transfer, simulation succeeded, no unknown programs were detected, and signer SOL delta is visible. This can proceed if the agent's local policy permits automatic signing.
```

## Intent-Mismatch Prompt

```text
You are an autonomous Solana signing agent.

The user says this transaction swaps 1 SOL for USDC on Jupiter.
Before signing, call firewall_check with that stated intent.

Read test/fixtures/intent-mismatch-setauthority.b64 and decide whether you would sign it.
```

Expected agent behavior:

```text
I will not auto-sign this transaction.

firewall_check returned WARN because the stated intent claims a swap, but the transaction changes token-account ownership. This must be escalated to a human.
```

## Video Flow

1. Show the repo README and the one-liner: `is_this_safe(tx)`.
2. Show the MCP config.
3. Ask the agent to inspect `transfer-allow.b64`; it calls `firewall_check` and reports `ALLOW`.
4. Ask the agent to inspect `drain-approve-close.b64`; it calls `firewall_check` and refuses to sign.
5. Ask the agent to inspect `intent-mismatch-setauthority.b64` with the stated swap intent; it escalates on `WARN`.
6. Close with: agents should refuse `BLOCK`, escalate `WARN`, and only auto-sign `ALLOW`.
