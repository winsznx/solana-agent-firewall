---
name: solana-agent-firewall
description: Pre-sign Solana transaction firewall for agents and builders. Use when Codex must inspect an unsigned serialized Solana transaction before signing, decide ALLOW/WARN/BLOCK, compare stated intent against observed transaction effects, explain risky instructions, apply signing policy, or integrate a CLI/MCP transaction safety gate into a Solana agent workflow.
---

# Solana Agent Firewall

Use this as `is_this_safe(tx)`: the pre-sign safety layer for Solana AI agents.

Use this skill to inspect a Solana transaction before it is signed. Treat the serialized unsigned transaction as the source of truth; never trust the stated intent as a substitute for decode, enrichment, simulation, and policy evaluation.

## Default Workflow

1. Collect the base64 serialized unsigned transaction.
2. Ask for or infer the RPC URL. Prefer `SOLANA_RPC_URL`; otherwise pass `--rpc-url`.
3. If the caller provides a stated intent, include it for intent reconciliation.
4. Run the firewall through CLI or MCP.
5. Interpret verdicts strictly:
   - `BLOCK`: refuse to sign.
   - `WARN`: escalate to a human or require explicit approval.
   - `ALLOW`: continue only if the caller's policy allows automatic signing.

## Use The Tool

Read [usage.md](usage.md) for CLI and MCP commands.

Use CLI for human review, CI checks, and demos:

```bash
pnpm firewall check ./tx.b64 --intent "swap 1 SOL for USDC on Jupiter" --rpc-url "$SOLANA_RPC_URL"
```

Use MCP when an agent holds an unsigned transaction and needs a pre-sign gate:

```json
{ "tx": "<base64>", "intent": "swap 1 SOL for USDC on Jupiter" }
```

## Load Details Only As Needed

- Read [architecture.md](architecture.md) when modifying the S0-S6 pipeline or explaining the system design.
- Read [detectors.md](detectors.md) when changing risk checks or severity logic.
- Read [token-2022-risks.md](token-2022-risks.md) when analyzing Token-2022 mints, transfer hooks, permanent delegates, freeze/default state, or transfer fees.
- Read [policy.md](policy.md) when writing or debugging a policy file.
- Read [simulation.md](simulation.md) when validating signer SOL/token deltas or explaining simulation limits.
- Read [resources.md](resources.md) when updating allowlists, known mints, fixtures, or external references.

## Safety Rules

- Do not mark a transaction `ALLOW` when RPC enrichment, ALT resolution, or simulation failed unless every instruction was decoded and no unknown program remains.
- Do not claim semantic understanding of an unknown program. Report it as unknown and use simulation effects plus policy to decide.
- Treat Token-2022 extension risks as runtime fund risks, not metadata trivia.
- Keep false positives actionable: block hard drains and unlimited approvals, warn on ambiguity, and explain evidence with instruction indices.
