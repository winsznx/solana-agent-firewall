import type { Finding, PolicyConfig, PolicyEvaluation, SimulationResult, TransactionContext } from "./types.js";
import { LAMPORTS_PER_SOL, shorten } from "./utils.js";

export function evaluatePolicy(
  context: TransactionContext,
  findings: Finding[],
  simulation: SimulationResult | undefined,
  policy: PolicyConfig
): PolicyEvaluation {
  const violations: Finding[] = [];

  for (const instruction of context.decodedInstructions) {
    if (policy.programs.deny.includes(instruction.programId)) {
      violations.push({
        id: "UNKNOWN_PROGRAM_CPI",
        severity: "CRITICAL",
        instructionIndex: instruction.index,
        detail: `Program ${shorten(instruction.programId)} is denied by policy.`,
        evidence: { programId: instruction.programId }
      });
    }
    if (policy.programs.denyUnknown && !instruction.decoded) {
      violations.push({
        id: "UNKNOWN_PROGRAM_CPI",
        severity: "CRITICAL",
        instructionIndex: instruction.index,
        detail: `Unknown program ${shorten(instruction.programId)} is blocked by policy.`,
        evidence: { programId: instruction.programId }
      });
    }
  }

  const outflowSol = simulation ? Math.max(0, -simulation.solDeltaLamports / LAMPORTS_PER_SOL) : 0;
  if (outflowSol > policy.limits.maxSolOutflow) {
    violations.push({
      id: "OUTFLOW_OVER_LIMIT",
      severity: "CRITICAL",
      detail: `Signer SOL outflow ${outflowSol.toFixed(6)} exceeds policy cap ${policy.limits.maxSolOutflow}.`,
      evidence: { outflowSol, maxSolOutflow: policy.limits.maxSolOutflow }
    });
  }

  if (outflowSol > policy.humanApproval.thresholdSol) {
    violations.push({
      id: "HUMAN_APPROVAL_REQUIRED",
      severity: "HIGH",
      detail: `Signer SOL outflow ${outflowSol.toFixed(6)} exceeds human-approval threshold ${policy.humanApproval.thresholdSol}.`,
      evidence: { outflowSol, thresholdSol: policy.humanApproval.thresholdSol }
    });
  }

  if (policy.approvals.blockUnlimited && findings.some((finding) => finding.id === "UNLIMITED_APPROVE" && finding.severity === "CRITICAL")) {
    violations.push({
      id: "UNLIMITED_APPROVE",
      severity: "CRITICAL",
      detail: "Unlimited approvals are blocked by policy.",
      evidence: { blockUnlimited: true }
    });
  }

  return { evaluated: true, violations };
}
