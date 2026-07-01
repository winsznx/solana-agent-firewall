# Demo Video Script

Target length: 2-3 minutes.

Title: `Solana Agent Firewall: is_this_safe(tx) for Solana AI agents`

## Before You Press Record

Open these tabs in your editor:

1. `README.md`
2. `skill/SKILL.md`
3. `scripts/mcp-agent-demo.ts`
4. Terminal at the repo root

Make sure the terminal is in:

```bash
/Users/mac/solana skill/solana-agent-firewall
```

Keep this command ready:

```bash
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" pnpm demo:agent
```

If you have a faster RPC URL, use that instead of public RPC.

## Step 1 - Open On The README

Do:

- Show the top of `README.md`.
- Put the cursor near the line: `is_this_safe(tx)`.

Say:

```text
This is Solana Agent Firewall.

The idea is simple: is_this_safe(tx) for Solana AI agents. Before an agent signs a Solana transaction, this skill checks the actual serialized transaction and returns ALLOW, WARN, or BLOCK.
```

## Step 2 - Explain The Problem

Do:

- Stay on the README.
- Slowly scroll just enough to show the install and demo sections.

Say:

```text
Most Solana security tooling checks source code before deployment. But agents need protection at the moment they are about to sign.

A transaction can look like a swap, but actually grant unlimited approval, change token authority, or close accounts into an attacker wallet. This skill protects that signing boundary.
```

## Step 3 - Show It Is A Real Skill

Do:

- Open `skill/SKILL.md`.
- Show the file tree with `skill/`, `agents/`, `commands/`, and `install.sh` visible if possible.

Say:

```text
This is not just a script. It is packaged as an installable Solana AI Kit skill.

The skill folder has SKILL.md as the entry point, with focused docs for detectors, policy, simulation, architecture, and Token-2022 risks. It also includes agent and command surfaces, plus an installer.
```

## Step 4 - Show The Agent Runtime

Do:

- Open `scripts/mcp-agent-demo.ts`.
- Scroll only a little, enough to show it connects to MCP and calls `firewall_check`.

Say:

```text
The runtime has two surfaces over the same core.

Humans and CI can use the CLI. Agents can use the MCP server through the firewall_check tool. This demo uses the MCP path, so it shows how an agent would call the skill before signing.
```

## Step 5 - Run The Agent Demo

Do:

- Switch to terminal.
- Run:

```bash
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" pnpm demo:agent
```

Say while it starts:

```text
Now I am running the live agent demo. This starts the local MCP server, connects with an MCP client, and asks the firewall to review three transactions.
```

## Step 6 - First Result: ALLOW

Do:

- When the terminal shows the clean transfer result, pause.
- Let `ALLOW` be visible on screen.

Say:

```text
First, the agent checks a clean funded SOL transfer.

The firewall returns ALLOW. Simulation succeeds, there are no unknown programs, and the signer delta is visible. This is the type of transaction an agent can continue with if local policy permits auto-signing.
```

## Step 7 - Second Result: BLOCK

Do:

- Let the drain result be visible.
- Point attention to `BLOCK` and the finding names if they are visible.

Say:

```text
Second, the agent checks a crafted drain transaction.

The firewall returns BLOCK because it detects an unlimited SPL token approval and a close-account pattern. In an agent workflow, this means refuse to sign.
```

## Step 8 - Third Result: WARN

Do:

- Let the intent mismatch result be visible.
- Point attention to `WARN`.

Say:

```text
Third, the stated user intent says this is a swap, but the transaction actually changes token-account ownership.

The firewall returns WARN with an intent mismatch. The agent should not blindly sign this. It should escalate to a human.
```

## Step 9 - Close Strong

Do:

- Switch back to `README.md` or the GitHub repo page.
- Keep the project name visible.

Say:

```text
The key is that the verdict comes from the transaction itself: decoded instructions, Address Lookup Table resolution, simulation effects, signer deltas, Token-2022 risk signals, and policy rules.

So this is not another generic AI explains Solana project. It is a pre-sign safety layer that agents can actually call before moving funds.

Solana Agent Firewall gives agents a simple rule: allow safe transactions, escalate warnings, and block dangerous signing.
```

## If The Terminal Output Is Too Fast

Say this after the command finishes:

```text
Here are the three decisions from the MCP agent demo: the clean transfer is ALLOW, the drain pattern is BLOCK, and the intent mismatch is WARN.
```

## Expected Terminal Shape

The exact wording can differ, but the important visible proof is:

```text
Agent connected to MCP tools: firewall_check

Scenario: clean funded transfer
Decision: ALLOW

Scenario: unlimited approval + close-account drain
Decision: BLOCK

Scenario: stated swap intent, actual authority change
Decision: WARN
```

## Backup If RPC Fails

Do:

- Say public RPC is rate-limited.
- Run these CLI commands instead:

```bash
pnpm firewall check test/fixtures/transfer-allow.b64 --rpc-url "$SOLANA_RPC_URL"
pnpm firewall check test/fixtures/drain-approve-close.b64
pnpm firewall check test/fixtures/intent-mismatch-setauthority.b64 --intent "swap 1 SOL for USDC on Jupiter"
```

Say:

```text
The CLI and MCP use the same shared engine, so the verdict contract is identical. MCP is the agent surface, and CLI is the human and CI surface.
```
