# Resources

## Code Entry Points

- `src/core/index.ts`: shared `firewallCheck(input)` entrypoint.
- `src/cli.ts`: CLI wrapper.
- `src/mcp.ts`: MCP stdio server.
- `src/core/allowlist.ts`: curated protocols, verified mints, infra/pool accounts.
- `src/core/static-scan.ts`: deterministic instruction detectors.
- `src/core/enrich.ts`: RPC enrichment for mints/programs/concentration.
- `src/core/simulate.ts`: simulation and signer delta computation.

## Maintenance Notes

- Update program allowlists by public key, never by display name.
- Keep verified mints conservative.
- Add detector fixtures whenever a new detector is added.
- Keep unknown-program behavior honest: do not infer semantics from an 8-byte discriminator unless the program is pinned.
