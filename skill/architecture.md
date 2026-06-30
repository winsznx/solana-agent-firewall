# Architecture

The firewall has one shared core with two thin surfaces: CLI and MCP. Both call the same `firewallCheck(input)` function and return the same verdict object.

## Pipeline

1. **S0 ingest and decode**
   - Deserialize base64 unsigned legacy or v0 transaction.
   - Resolve Address Lookup Tables through RPC when present.
   - Reconstruct full account keys before decoding compiled instruction indices.
   - Decode known programs and keep unknown program instructions opaque.

2. **S1 static scan**
   - Run deterministic checks over decoded instructions.
   - Detect unlimited approvals, authority handoffs, account close drains, burns, program upgrades, unknown programs, and priority-fee caps.

3. **S2 on-chain enrich**
   - Fetch account state through batched RPC.
   - Decode signer token accounts, mints, Token-2022 extension signals, and unknown program upgrade authority.
   - Run concentration checks only for fresh or unknown mints.

4. **S3 simulate**
   - Run `simulateTransaction` with `sigVerify: false` and `replaceRecentBlockhash: true`.
   - Enumerate signer and writable accounts so signer SOL and token deltas can be computed.

5. **S4 intent reconcile**
   - Compare stated intent with observed programs, decoded instruction names, and simulated value movement.
   - Flag mismatches such as "swap" intent plus `SetAuthority`.

6. **S5 policy eval**
   - Merge user policy over safe defaults.
   - Apply denied programs, unknown-program behavior, outflow caps, priority-fee caps, approval rules, and human-approval threshold.

7. **S6 verdict synthesis**
   - Aggregate findings and policy violations.
   - Apply fail-safe confidence and the ALLOW clamp.

## Fail-Safe Invariant

Missing data never silently clears a transaction. RPC unavailable, ALT unresolved, unknown programs, and simulation failure reduce confidence and lead to `WARN` or `BLOCK`.
