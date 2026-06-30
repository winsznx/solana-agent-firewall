# Detectors

Severity scale: `INFO < LOW < MEDIUM < HIGH < CRITICAL`.

## Static Detectors

- `UNLIMITED_APPROVE`: SPL Token or Token-2022 `Approve`/`ApproveChecked`.
  - `u64::MAX` is `CRITICAL` when unlimited approvals are blocked by policy.
  - Bounded approvals are lower severity unless delegated to an unknown counterparty.
- `MINT_FREEZE_HANDOFF`: `SetAuthority(MintTokens|FreezeAccount)`.
  - New non-null authority is `CRITICAL`.
  - Burning authority to `None` is low-risk.
- `ACCOUNT_OWNER_CHANGE`: `SetAuthority(AccountOwner)` is `HIGH`.
- `ACCOUNT_CLOSE_DRAIN`: `CloseAccount`.
  - Destination signer: `INFO`.
  - Destination non-signer: `HIGH`.
- `TOKEN_BURN`: signer token burn is `MEDIUM`.
- `PROGRAM_UPGRADE`: BPF upgradeable loader `Upgrade` or authority change is `HIGH`.
- `UNKNOWN_PROGRAM_CPI`: top-level unknown program is `MEDIUM`, higher when policy denies unknowns or simulation shows signer outflow.
- `PRIORITY_FEE_DRAIN`: estimated priority fee above policy cap is `MEDIUM`.

## Enrichment Detectors

- `T22_PERMANENT_DELEGATE`: Token-2022 mint with permanent delegate. Default policy makes this `CRITICAL`.
- `T22_TRANSFER_HOOK`: Token-2022 transfer hook. `HIGH` unless policy denies it, in which case `CRITICAL`.
- `T22_FREEZE_RISK`: live freeze authority or frozen default account state. `MEDIUM`, or `CRITICAL` if denied by policy.
- `T22_TRANSFER_FEE`: transfer fee config. `INFO` unless future fee magnitude checks make it higher.
- `MINT_AUTHORITY_LIVE`: live mint authority. `LOW` by default.
- `HOLDER_CONCENTRATION`: weak token-account-level signal. Never use as the sole reason to block.

## Intent Detector

- `INTENT_MISMATCH`: stated intent diverges from decoded reality, such as a claimed swap that includes authority mutation. `HIGH`.

## Policy Detectors

- `OUTFLOW_OVER_LIMIT`: signer SOL outflow exceeds policy cap. `CRITICAL`.
- `HUMAN_APPROVAL_REQUIRED`: signer SOL outflow exceeds manual-review threshold. `HIGH`.
