# Policy

Policy files are JSON objects merged over built-in defaults.

```json
{
  "programs": {
    "allow": [],
    "deny": [],
    "denyUnknown": false
  },
  "limits": {
    "maxSolOutflow": 5,
    "maxPriorityFeeLamports": 1000000
  },
  "tokens": {
    "denyLiveFreezeAuthority": false,
    "denyPermanentDelegate": true,
    "transferHook": "unlessAllowlisted"
  },
  "approvals": {
    "blockUnlimited": true,
    "maxApproveToUnknown": 0
  },
  "humanApproval": {
    "thresholdSol": 1
  }
}
```

## Suggested Agent Policy

For autonomous signing, keep `blockUnlimited` and `denyPermanentDelegate` enabled. Set `humanApproval.thresholdSol` low enough that the agent escalates high-value transactions.

## Suggested CI Policy

For CI, use `denyUnknown: true` when testing known transaction builders. This catches accidental program drift.
