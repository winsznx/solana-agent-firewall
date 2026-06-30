import type { PolicyConfig } from "./types.js";

export const DEFAULT_POLICY: PolicyConfig = {
  programs: {
    allow: [],
    deny: [],
    denyUnknown: false
  },
  limits: {
    maxSolOutflow: 5,
    maxPriorityFeeLamports: 1_000_000
  },
  tokens: {
    denyLiveFreezeAuthority: false,
    denyPermanentDelegate: true,
    transferHook: "unlessAllowlisted"
  },
  approvals: {
    blockUnlimited: true,
    maxApproveToUnknown: 0
  },
  humanApproval: {
    thresholdSol: 1
  }
};

export function mergePolicy(policy?: Partial<PolicyConfig>): PolicyConfig {
  return {
    programs: {
      ...DEFAULT_POLICY.programs,
      ...policy?.programs,
      allow: policy?.programs?.allow ?? DEFAULT_POLICY.programs.allow,
      deny: policy?.programs?.deny ?? DEFAULT_POLICY.programs.deny
    },
    limits: {
      ...DEFAULT_POLICY.limits,
      ...policy?.limits
    },
    tokens: {
      ...DEFAULT_POLICY.tokens,
      ...policy?.tokens
    },
    approvals: {
      ...DEFAULT_POLICY.approvals,
      ...policy?.approvals
    },
    humanApproval: {
      ...DEFAULT_POLICY.humanApproval,
      ...policy?.humanApproval
    }
  };
}
