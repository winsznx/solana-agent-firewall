# Demo Video Script

Target length: 2-3 minutes.

Title: `Solana Agent Firewall: is_this_safe(tx) for Solana AI agents`

## Before Recording

Open the repo in your editor and keep one terminal ready.

Use this terminal command for the live agent/MCP proof:

```bash
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" pnpm demo:agent
```

If public RPC is slow, use your faster RPC URL.

## Screen Flow

1. Start on `README.md`.
2. Open `skill/SKILL.md`.
3. Open `src/mcp.ts` or `scripts/mcp-agent-demo.ts`.
4. Run the live demo command.
5. End on the GitHub repo page or README.

## Voice Script

Hi, this is Solana Agent Firewall.

The one-line idea is simple: `is_this_safe(tx)` for Solana AI agents. Before an agent signs a transaction, this skill checks the actual serialized transaction and returns `ALLOW`, `WARN`, or `BLOCK`.

The reason this matters is that most security tooling looks at source code before deploy. But agents need protection at the signing boundary. A planner, plugin, UI, or external protocol can hand the agent a transaction that looks like a swap but actually changes authority, grants unlimited approval, or closes token accounts into an attacker wallet.

This repo is built as an installable Solana AI Kit skill, not just a script. Here is the `skill/` folder, with `SKILL.md` as the entry point, and focused docs for detectors, policy, simulation, architecture, and Token-2022 risks. It also includes `agents/`, `commands/`, and `install.sh`, so it follows the shape the bounty asked for.

The runtime has two surfaces over the same core. Humans and CI can use the CLI. Agents can use the MCP server through the `firewall_check` tool.

Now I will show the agent path.

This command starts the local MCP server, connects with an MCP client, and calls `firewall_check` the way an agent would before signing.

Run:

```bash
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" pnpm demo:agent
```

First, the agent checks a clean funded SOL transfer. The firewall returns `ALLOW`. Simulation succeeds, there are no unknown programs, and the signer delta is visible. This is the kind of transaction an agent can continue with, if local policy allows auto-signing.

Second, the agent checks a crafted drain transaction. The firewall returns `BLOCK`. It detects unlimited SPL token approval and a close-account pattern that redirects value. The agent should refuse to sign this.

Third, the user intent says this is a swap, but the transaction actually changes token-account ownership. The firewall returns `WARN` with an intent mismatch, so the agent escalates instead of blindly signing.

The important thing is that the verdict is based on the transaction itself: decoded instructions, Address Lookup Table resolution, simulation effects, signer deltas, Token-2022 risk signals, and policy rules.

So this is not another generic "AI explains Solana" skill. It is a pre-sign safety layer that agents can actually call before moving funds.

Final line:

Solana Agent Firewall is an installable Solana AI Kit skill for runtime transaction safety: `ALLOW` safe transactions, escalate `WARN`, and block dangerous signing.

## What To Show In Terminal

Expected demo shape:

```text
Agent connected to MCP tools: firewall_check

Scenario: clean funded transfer
Decision: ALLOW

Scenario: unlimited approval + close-account drain
Decision: BLOCK

Scenario: stated swap intent, actual authority change
Decision: WARN
```

It is fine if the exact wording differs. The key proof is that the command is using the MCP path and the three decisions are visible.

## Optional Backup Commands

If the MCP demo has RPC trouble, show the same core through CLI:

```bash
pnpm firewall check test/fixtures/transfer-allow.b64 --rpc-url "$SOLANA_RPC_URL"
pnpm firewall check test/fixtures/drain-approve-close.b64
pnpm firewall check test/fixtures/intent-mismatch-setauthority.b64 --intent "swap 1 SOL for USDC on Jupiter"
```

Close by saying the CLI and MCP use the same shared engine, so the verdict contract is identical.
