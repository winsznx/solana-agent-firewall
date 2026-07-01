# Agent Progress

## Phase 0 - Recon, Scope, And Scaffold

- Read the bounty brief, prior chat, PRD, and the live `solana-game-skill` reference shape.
- Locked the build target as `solana-agent-firewall`: a runtime pre-sign firewall for Solana agents, not another static code-audit skill.
- Created the repository skeleton under `solana-agent-firewall/` with package metadata, TypeScript config, Vitest config, and the planned `skill/`, `src/`, `agents/`, `commands/`, and `test/` directories.
- Chose to keep one shared TypeScript core with CLI and MCP adapters so both surfaces return the same verdict contract.

## Phase 1 - Shared Core And Verdict Contract

- Added the shared TypeScript contracts for firewall input, policy, decoded instructions, findings, simulation effects, policy evaluation, confidence, and the final verdict object.
- Implemented transaction ingest for base64 serialized legacy/v0 transactions, including local Address Lookup Table resolution when RPC is available and fail-safe findings when ALTs cannot be resolved.
- Added known-program decoders for System, Compute Budget, SPL Token, Token-2022, Associated Token Account, BPF Upgradeable Loader, and curated protocol allowlist entries.
- Implemented deterministic static detectors for unlimited approvals, authority handoffs, token-account owner changes, close-account drains, token burns, program upgrades, unknown programs, and priority-fee caps.
- Added RPC enrichment for token accounts, mints, Token-2022 extension signals, program upgrade authority, and holder-concentration context with a TTL cache and verified-mint fast path.
- Added simulation/delta plumbing for signer SOL and signer-owned token-account deltas, plus intent reconciliation, policy evaluation, and final `ALLOW / WARN / BLOCK` synthesis with the fail-safe/ALLOW clamp.

## Phase 2 - CLI And MCP Surfaces

- Added `src/cli.ts` as a thin human/CI surface over the shared core: `firewall check <tx-or-file> --intent --policy --rpc-url --json`.
- Added terminal rendering for verdict, confidence, summary, transaction metadata, signer effects, findings, and simulation status, while preserving `--json` for exact machine-readable output.
- Added `src/mcp.ts` as an MCP stdio server exposing `firewall_check({ tx, intent?, policy?, rpcUrl?, cluster? })`.
- Kept both surfaces intentionally thin so CLI and MCP return the same core verdict object and cannot drift in behavior.

## Phase 3 - Skill Packaging And Submission Docs

- Added `README.md` with problem framing, install steps, CLI/MCP usage, safety model, known limits, and skill package overview.
- Added `install.sh` and made it executable; it installs dependencies and builds the TypeScript package.
- Added `skill/SKILL.md` as the progressive router for Codex/Solana AI Kit usage.
- Added focused skill docs for architecture, detectors, Token-2022 risks, policy, simulation, usage, and maintenance resources.
- Added `commands/firewall-check.md` and `agents/tx-firewall-reviewer.md` so the package has both command and agent affordances.
- Kept the docs oriented around the bounty rubric: real builder usefulness, novelty as runtime sign-time safety, production quality, and clean fit into the kit.

## Phase 4 - Tests And Offline Fixtures

- Added Vitest coverage for the core behavior using real Solana `VersionedTransaction` and `TransactionMessage` objects generated locally.
- Covered critical drain behavior: unlimited SPL Token approval plus close-account-to-attacker returns `BLOCK`.
- Covered intent reconciliation: a claimed swap that mutates mint authority produces `INTENT_MISMATCH` and a blocking authority-handoff finding.
- Covered policy hard-deny behavior for unknown programs.
- Covered parse-failure behavior for invalid transaction input.
- Added `test/fixtures/README.md` as the placeholder for future collected mainnet `.b64` fixtures.

## Phase 5 - Verification, Packaging, And Polish

- Installed dependencies with `pnpm install`.
- Fixed TypeScript strict-mode inference in transaction ingest and corrected the build output layout so package bins resolve to `dist/cli.js` and `dist/mcp.js`.
- Verified `pnpm build` passes.
- Verified `pnpm test` passes: 1 test file, 4 tests.
- Verified `pnpm firewall --version` resolves the local CLI script.
- Ran a generated dangerous-transaction CLI smoke test; it exits with status `2` and returns `BLOCK` with `UNLIMITED_APPROVE`.
- Ran a public mainnet RPC smoke test with a generated unfunded transfer; simulation path runs and returns `WARN` with `simulation.ran: true`.
- Ran `pnpm pack --dry-run`; package contents are clean and include only intended dist output plus skill/docs/agent/command/install/license files.
- Attempted the Codex `quick_validate.py` skill validator. The script exists but could not complete because the local Python environment lacks `PyYAML`; a manual frontmatter sanity check passed.
- Fixed a concentration math bug so largest-holder concentration is a true percentage of token supply, not a raw UI amount.
- Noted the non-fatal Solana dependency warning: `bigint-buffer` native bindings were not loaded, so pure JS fallback is used.

## Phase 6 - Claude P0 Hardening: Real Fixture Harness

- Read the external `fetch-fixtures.ts` proposal and adapted it into `scripts/fetch-fixtures.ts`.
- Added `tsx` and package scripts:
  - `pnpm fetch:fixtures`
  - `pnpm test:fixtures`
- Added manifest-backed fixture tests in `test/fixture-manifest.test.ts` so sidecar metadata drives expected verdicts, required findings, and structural assertions.
- Generated offline fixtures:
  - `drain-approve-close` -> `BLOCK`
  - `intent-mismatch-setauthority` -> `WARN`
- Fetched a real Jupiter v0+ALT fixture from mainnet:
  - signature `26QTBt4XbNgVs3NdrZP18vKE4dqzp6t3bPsBQt56aivaHsZri8BvEXriMmGCEnvPtSQJH8eLHcawX2hjMbR7QsC5`
  - slot `429941708`
  - sidecar asserts at least one lookup table, no critical findings, no unknown top-level program findings, and simulation attempted.
- Ran `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com pnpm test:fixtures`; after extending the fixture timeout to 90s, all 3 manifest fixtures passed despite public RPC 429 retries.
- Inspected the Jupiter fixture through the CLI:
  - verdict `WARN`
  - `lookupTableCount: 3`
  - `accountCount: 42`
  - `unknownPrograms: []`
  - `simulation.ran: true`
  - `simulation.success: false` with Jupiter custom error, which is acceptable for a historical swap re-simulated against current pool state.
- Fixed a real fail-safe bug found by the fixture run: pre-simulation account fetch errors now degrade through the simulation failure path instead of escaping as fake `UNPARSEABLE` parse failures.
- Added `lookupTableCount`, `accountCount`, and `unknownPrograms` to the verdict transaction metadata so real ALT and unknown-program assertions can be tested.
- Ran the official Codex skill validator using a temporary PyYAML venv; `Skill is valid!`.
- Suppressed the known `bigint-buffer` native fallback warning in CLI/MCP boot paths so demos do not show scary stderr. Direct core tests can still show the warning because they intentionally import the core without the CLI bootstrap.
- Remaining real-fixture inputs needed for full P0: a funded read-only `FIXTURE_FROM_ADDRESS` for the clean transfer ALLOW showcase, and a verified `FIXTURE_T22_MINT` carrying PermanentDelegate for the Token-2022 BLOCK showcase.

## Phase 7 - Funded Transfer Fixture Proof

- Generated a local fixture wallet and added `.fixture-wallet.json` to `.gitignore`.
- User funded the fixture address `GQ2gh9rQRXPg3UczKQDzUdjRAz9gfYAQfSpZQDbF88kQ` with `0.004640052 SOL`.
- Regenerated fixtures with `FIXTURE_FROM_ADDRESS=GQ2gh9rQRXPg3UczKQDzUdjRAz9gfYAQfSpZQDbF88kQ`.
- Added `transfer-allow.b64` and sidecar metadata to `test/fixtures/`.
- Ran `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com pnpm test:fixtures`; all 4 manifest fixtures passed:
  - `drain-approve-close`
  - `intent-mismatch-setauthority`
  - `transfer-allow`
  - `jupiter-swap`
- Inspected the transfer fixture through the CLI:
  - verdict `ALLOW`
  - confidence `HIGH`
  - simulation success `true`
  - compute units `150`
  - signer SOL delta `-0.00001 SOL`
  - unknown programs `[]`
- Remaining real-fixture input for full P0: a verified `FIXTURE_T22_MINT` carrying PermanentDelegate, TransferHook, or another Token-2022 risk.

## Phase 8 - Public Submission And Bounty PR

- Confirmed the main repo is clean and pushed to `https://github.com/winsznx/solana-agent-firewall`.
- Verified `.fixture-wallet.json` is ignored and not tracked, so the generated local fixture wallet secret was not published.
- Cloned `https://github.com/solanabr/skill-bounty` to inspect the requested PR target.
- Found the bounty repo has no special README/template beyond its MIT license, so added a lightweight submission file instead of duplicating the full project.
- Forked the bounty repo under `winsznx/skill-bounty`.
- Added `submissions/solana-agent-firewall.md` summarizing the repo, skill fit, runtime surfaces, proofs, checks, and fail-safe model.
- Opened PR `https://github.com/solanabr/skill-bounty/pull/148` from `winsznx:add-solana-agent-firewall` into `solanabr/skill-bounty:main`.
- The remaining manual step is the Superteam Earn form submission, because it requires the user's logged-in browser/session and bounty credit.
