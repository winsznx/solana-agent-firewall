# Solana Agent Firewall

**`is_this_safe(tx)` — the pre-sign safety layer for Solana AI agents.**

`solana-agent-firewall` is an installable Solana AI Kit skill plus a working CLI/MCP tool. It inspects a base64 serialized unsigned Solana transaction before an agent signs, then returns a structured `ALLOW`, `WARN`, or `BLOCK` verdict with signer effects, policy violations, and concrete evidence.

## Install

Clone and build:

```bash
git clone https://github.com/winsznx/solana-agent-firewall.git
cd solana-agent-firewall
pnpm install
pnpm build
```

Install the skill into another skill directory:

```bash
SKILL_INSTALL_DIR=/path/to/solana-ai-kit/skills ./install.sh
```

Use locally without copying:

```bash
pnpm firewall check test/fixtures/transfer-allow.b64 --rpc-url "$SOLANA_RPC_URL"
pnpm mcp
```

When installed as a package or linked globally, the binaries are also available as `firewall` and `solana-agent-firewall-mcp`.

## Agent Demo

This is designed to be shown as an agent safety gate:

> An autonomous Solana agent receives a transaction, calls `firewall_check`, then refuses `BLOCK`, escalates `WARN`, and only continues on `ALLOW`.

See [demo/agent-demo.md](demo/agent-demo.md) for MCP config, Claude/Codex-style prompts, and a 2-3 minute recording flow.

## Demo Proof

The repo ships manifest-backed fixtures that prove the safety gate on real transaction shapes:

| Fixture | Expected | What it proves |
| --- | --- | --- |
| `transfer-allow` | `ALLOW` | A funded, clean SOL transfer simulates successfully with signer delta `-0.00001 SOL`. |
| `drain-approve-close` | `BLOCK` | Unlimited SPL approval plus close-account rent redirect is blocked. |
| `intent-mismatch-setauthority` | `WARN` | Claimed "swap" intent is caught when the transaction actually changes token-account owner. |
| `jupiter-swap` | `ALLOW` or `WARN` | Real mainnet Jupiter v0 transaction resolves ALTs and has no unknown top-level programs or false critical findings. Historical swaps can warn when current pool state makes re-simulation fail. |

Run:

```bash
export SOLANA_RPC_URL="https://<your-helius-or-mainnet-rpc>"
pnpm test:fixtures
```

Public Solana RPC can rate-limit the Jupiter fixture. Use a dedicated RPC for the final demo.

## Why This Exists

Most Solana security tooling audits source code before deployment. Agents need a runtime guard at sign-time, often while interacting with programs they did not write. This firewall is designed for that gap: simulation before signing, instruction risk detection, Token-2022 risk signals, program authority checks, intent mismatch detection, and policy caps.

## CLI

```bash
pnpm firewall check ./tx.b64 --rpc-url https://api.mainnet-beta.solana.com
pnpm firewall check ./tx.b64 --intent "swap 1 SOL for USDC on Jupiter" --json
pnpm firewall check ./tx.b64 --policy ./policy.json
```

Exit codes:

- `0`: `ALLOW`
- `1`: `WARN`
- `2`: `BLOCK` or parse failure

## MCP

Start the MCP server:

```bash
pnpm mcp
```

Tool call:

```json
{
  "name": "firewall_check",
  "arguments": {
    "tx": "<base64 unsigned transaction>",
    "intent": "swap 1 SOL for USDC on Jupiter",
    "rpcUrl": "https://api.mainnet-beta.solana.com"
  }
}
```

Agent policy:

- `BLOCK`: refuse to sign.
- `WARN`: escalate to a human.
- `ALLOW`: continue only when local policy permits automatic signing.

## Real Fixture Harness

Generate deterministic offline fixtures plus real mainnet fixtures:

```bash
export SOLANA_RPC_URL="https://<your-helius-or-mainnet-rpc>"
export FIXTURE_FROM_ADDRESS="<mainnet wallet with a little SOL>"
export FIXTURE_T22_MINT="<verified Token-2022 mint with PermanentDelegate>"
pnpm fetch:fixtures
```

Run the manifest-backed fixture suite:

```bash
pnpm test:fixtures
```

Notes:

- `FIXTURE_FROM_ADDRESS` is read-only. Nothing is signed or submitted; the firewall simulates an unsigned transfer from that address.
- `FIXTURE_T22_MINT` is optional for the included demo set, but useful for proving live Token-2022 extension detection.
- Historical Jupiter swaps may return `WARN` because current pool state can make re-simulation fail. The fixture asserts the important structural facts instead: v0+ALT resolution, no unknown top-level program, no false critical finding, and simulation attempted.

## What It Checks

- Legacy and v0 transactions, with Address Lookup Table resolution when RPC is available
- Known Solana programs: System, SPL Token, Token-2022, Associated Token Account, Compute Budget, BPF Upgradeable Loader, and curated protocol allowlist entries
- Unlimited approvals, token authority handoffs, account-owner changes, close-account drains, burns, program upgrades, priority-fee drain, unknown programs
- Token-2022 extensions: permanent delegate, transfer hook, freeze/default-state risk, transfer fees
- Program upgrade authority for unknown upgradeable programs
- Signer SOL and token-account deltas from real simulation
- Policy limits such as denied programs, unknown-program blocking, max SOL outflow, and human-approval thresholds

## Safety Model

The firewall is fail-safe. Missing RPC, unresolved ALTs, failed simulation, unknown programs, or incomplete enrichment produce `WARN` or `BLOCK`, never a silent `ALLOW`.

`ALLOW` requires:

- no high or critical findings
- no hard policy violation
- high confidence
- simulation success or every instruction decoded
- no unexplained unknown program

## Skill Package

The `skill/` directory contains the Solana AI Kit skill entrypoint and focused progressive docs:

- `skill/SKILL.md`
- `skill/architecture.md`
- `skill/detectors.md`
- `skill/token-2022-risks.md`
- `skill/policy.md`
- `skill/simulation.md`
- `skill/usage.md`
- `skill/resources.md`

## Known Limits

Simulation is a slot snapshot. A program can read state that changes between simulation and execution. For high-value transactions, re-run the firewall immediately before signing and keep policy outflow caps enabled.

Unknown program semantics are not guessed. The firewall reports opaque programs and judges them by observed effects and policy.

## License

MIT
