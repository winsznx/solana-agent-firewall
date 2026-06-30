# Simulation

Simulation provides the empirical backstop for programs the firewall cannot semantically decode.

## Method

- Run `simulateTransaction` with `sigVerify: false`.
- Use `replaceRecentBlockhash: true` so stale local blockhashes do not hide transaction behavior.
- Enumerate signer accounts and writable accounts in `accounts.addresses`.
- Compare pre-state and returned post-state to compute signer SOL deltas and signer-owned token-account deltas.

## Limits

Simulation is a slot snapshot. A transaction can behave differently if a program reads mutable state that changes between simulation and execution. For high-value flows, run the firewall immediately before signing and enforce policy outflow caps.

Simulation failure is not a clean bill of health. It becomes `WARN` with logs and error context.
