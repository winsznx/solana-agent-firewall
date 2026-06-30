# Token-2022 Risks

Token-2022 mints can add runtime behavior beyond legacy SPL Token. Treat extension checks as signing safety checks.

## High-Signal Extensions

- **PermanentDelegate**: a fixed delegate can transfer or burn tokens from accounts. Default policy blocks this.
- **TransferHook**: transfers CPI into a hook program that can reject or alter behavior. Warn unless the policy explicitly allows the hook environment.
- **DefaultAccountState**: accounts may default to frozen, which can strand funds.
- **TransferFeeConfig**: transfers can skim fees; simulation deltas are the source of truth for what the signer receives.
- **MintCloseAuthority / live mint authority**: supply or mint lifecycle can remain controlled by another party.

## Handling Rule

Branch on the token program owner before decoding mint data. Legacy SPL Token and Token-2022 share base layouts but not extension behavior.
