export type Verdict = "ALLOW" | "WARN" | "BLOCK";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FindingId =
  | "UNPARSEABLE"
  | "ALT_UNRESOLVED"
  | "UNLIMITED_APPROVE"
  | "MINT_FREEZE_HANDOFF"
  | "ACCOUNT_OWNER_CHANGE"
  | "ACCOUNT_CLOSE_DRAIN"
  | "TOKEN_BURN"
  | "PROGRAM_UPGRADE"
  | "T22_PERMANENT_DELEGATE"
  | "T22_TRANSFER_HOOK"
  | "T22_FREEZE_RISK"
  | "T22_TRANSFER_FEE"
  | "UNKNOWN_PROGRAM_CPI"
  | "PRIORITY_FEE_DRAIN"
  | "HOLDER_CONCENTRATION"
  | "MINT_AUTHORITY_LIVE"
  | "INTENT_MISMATCH"
  | "SIM_FAILED"
  | "OUTFLOW_OVER_LIMIT"
  | "HUMAN_APPROVAL_REQUIRED"
  | "RPC_UNAVAILABLE";

export interface FirewallInput {
  tx: string;
  intent?: string;
  policy?: Partial<PolicyConfig>;
  rpcUrl?: string;
  cluster?: "mainnet" | "devnet";
}

export interface PolicyConfig {
  programs: {
    allow: string[];
    deny: string[];
    denyUnknown: boolean;
  };
  limits: {
    maxSolOutflow: number;
    maxPriorityFeeLamports: number;
  };
  tokens: {
    denyLiveFreezeAuthority: boolean;
    denyPermanentDelegate: boolean;
    transferHook: "allow" | "deny" | "unlessAllowlisted";
  };
  approvals: {
    blockUnlimited: boolean;
    maxApproveToUnknown: number;
  };
  humanApproval: {
    thresholdSol: number;
  };
}

export interface AccountMetaView {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface DecodedInstruction {
  index: number;
  programId: string;
  programName: string;
  accounts: AccountMetaView[];
  dataBase64: string;
  decoded: boolean;
  name?: string;
  params?: Record<string, unknown>;
}

export interface TransactionContext {
  serialized: string;
  version: "legacy" | "0" | string;
  feePayer: string;
  instructionCount: number;
  altResolved: boolean;
  alreadySigned: boolean;
  accountKeys: AccountMetaView[];
  decodedInstructions: DecodedInstruction[];
  lookupTableAddresses: string[];
  signerKeys: string[];
  writableKeys: string[];
  unknownPrograms: string[];
  notes: string[];
}

export interface MintRisk {
  mint: string;
  ownerProgram: string;
  decimals?: number;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  extensions: string[];
  concentration?: {
    checked: boolean;
    largestNonInfraPercent?: number;
    note?: string;
  };
}

export interface ProgramRisk {
  programId: string;
  label?: string;
  allowlisted: boolean;
  upgradeable?: boolean;
  upgradeAuthority?: string | null;
}

export interface EnrichmentResult {
  ran: boolean;
  unknownChecks: string[];
  mints: MintRisk[];
  programs: ProgramRisk[];
}

export interface TokenDelta {
  account: string;
  mint?: string;
  owner?: string;
  deltaRaw: string;
  deltaUi?: string;
  program?: string;
}

export interface SimulationResult {
  ran: boolean;
  success: boolean;
  err?: unknown;
  computeUnits?: number;
  logsTail: string[];
  solDeltaLamports: number;
  solDelta: string;
  tokenDeltas: TokenDelta[];
}

export interface IntentResult {
  provided: boolean;
  claimed?: string;
  matches?: boolean;
  divergences: string[];
}

export interface Finding {
  id: FindingId;
  severity: Severity;
  instructionIndex?: number;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface PolicyEvaluation {
  evaluated: boolean;
  violations: Finding[];
}

export interface FirewallResult {
  verdict: Verdict;
  confidence: Confidence;
  summary: string;
  transaction: {
    version: string;
    feePayer: string;
    instructionCount: number;
    altResolved: boolean;
    lookupTableCount: number;
    accountCount: number;
    unknownPrograms: string[];
  };
  effects: {
    solDelta: string;
    tokenDeltas: TokenDelta[];
  };
  findings: Finding[];
  policy: PolicyEvaluation;
  simulation: {
    ran: boolean;
    success: boolean;
    computeUnits?: number;
    logsTail: string[];
  };
  intent: IntentResult;
}

export interface FirewallArtifacts {
  context?: TransactionContext;
  enrich?: EnrichmentResult;
  simulation?: SimulationResult;
  intent?: IntentResult;
  findings: Finding[];
  policy: PolicyEvaluation;
}

export const severityRank: Record<Severity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

export function maxSeverity(findings: Finding[]): Severity {
  return findings.reduce<Severity>(
    (max, finding) => (severityRank[finding.severity] > severityRank[max] ? finding.severity : max),
    "INFO"
  );
}
