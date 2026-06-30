import type {
  EnrichmentResult,
  Finding,
  FirewallResult,
  IntentResult,
  PolicyEvaluation,
  SimulationResult,
  TransactionContext
} from "./types.js";
import { maxSeverity, severityRank } from "./types.js";

export function synthesizeVerdict(args: {
  context: TransactionContext;
  findings: Finding[];
  policy: PolicyEvaluation;
  simulation: SimulationResult;
  intent: IntentResult;
  enrich: EnrichmentResult;
}): FirewallResult {
  const allFindings = [...args.findings, ...args.policy.violations];
  const highest = maxSeverity(allFindings);
  const confidence = confidenceFor(args.simulation, args.enrich, args.context, allFindings);
  const everyInstructionDecoded = args.context.decodedInstructions.every((instruction) => instruction.decoded);
  const unexplainedUnknown = args.context.unknownPrograms.length > 0;

  let verdict: FirewallResult["verdict"] = "WARN";
  if (allFindings.some((finding) => finding.severity === "CRITICAL" || finding.id === "UNPARSEABLE")) {
    verdict = "BLOCK";
  } else if (
    severityRank[highest] < severityRank.HIGH &&
    confidence === "HIGH" &&
    (args.simulation.success || everyInstructionDecoded) &&
    !unexplainedUnknown
  ) {
    verdict = "ALLOW";
  } else {
    verdict = "WARN";
  }

  return {
    verdict,
    confidence,
    summary: summarize(verdict, allFindings, args.context, args.simulation),
    transaction: {
      version: args.context.version,
      feePayer: args.context.feePayer,
      instructionCount: args.context.instructionCount,
      altResolved: args.context.altResolved,
      lookupTableCount: args.context.lookupTableAddresses.length,
      accountCount: args.context.accountKeys.length,
      unknownPrograms: args.context.unknownPrograms
    },
    effects: {
      solDelta: args.simulation.solDelta,
      tokenDeltas: args.simulation.tokenDeltas
    },
    findings: allFindings,
    policy: args.policy,
    simulation: {
      ran: args.simulation.ran,
      success: args.simulation.success,
      computeUnits: args.simulation.computeUnits,
      logsTail: args.simulation.logsTail
    },
    intent: args.intent
  };
}

export function blockForParseError(message: string): FirewallResult {
  return {
    verdict: "BLOCK",
    confidence: "LOW",
    summary: `Could not parse transaction: ${message}`,
    transaction: {
      version: "unknown",
      feePayer: "unknown",
      instructionCount: 0,
      altResolved: false,
      lookupTableCount: 0,
      accountCount: 0,
      unknownPrograms: []
    },
    effects: {
      solDelta: "0 SOL",
      tokenDeltas: []
    },
    findings: [
      {
        id: "UNPARSEABLE",
        severity: "CRITICAL",
        detail: message
      }
    ],
    policy: { evaluated: false, violations: [] },
    simulation: { ran: false, success: false, logsTail: [] },
    intent: { provided: false, divergences: [] }
  };
}

function confidenceFor(
  simulation: SimulationResult,
  enrich: EnrichmentResult,
  context: TransactionContext,
  findings: Finding[]
): FirewallResult["confidence"] {
  if (!simulation.ran || !context.altResolved) {
    return "LOW";
  }
  if (!simulation.success || !enrich.ran || findings.some((finding) => finding.id === "RPC_UNAVAILABLE")) {
    return "MEDIUM";
  }
  return "HIGH";
}

function summarize(
  verdict: FirewallResult["verdict"],
  findings: Finding[],
  context: TransactionContext,
  simulation: SimulationResult
): string {
  const critical = findings.find((finding) => finding.severity === "CRITICAL");
  if (verdict === "BLOCK" && critical) {
    return `Blocked: ${critical.detail}`;
  }
  const high = findings.find((finding) => finding.severity === "HIGH");
  if (verdict === "WARN" && high) {
    return `Warning: ${high.detail}`;
  }
  if (verdict === "ALLOW") {
    return `No high-risk findings across ${context.instructionCount} instruction(s); observed signer SOL delta ${simulation.solDelta}.`;
  }
  return `Warning: transaction could not be fully cleared; ${findings.length} finding(s), signer SOL delta ${simulation.solDelta}.`;
}
