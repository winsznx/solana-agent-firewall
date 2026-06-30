import { isProgramAllowlisted, PROGRAMS } from "./allowlist.js";
import type { DecodedInstruction, Finding, PolicyConfig, TransactionContext } from "./types.js";
import { U64_MAX, shorten } from "./utils.js";

export function staticScan(context: TransactionContext, policy: PolicyConfig): Finding[] {
  const findings: Finding[] = [];
  let computeUnitLimit = 200_000;
  let computeUnitPriceMicroLamports = 0n;

  for (const instruction of context.decodedInstructions) {
    if (!instruction.decoded) {
      findings.push({
        id: "UNKNOWN_PROGRAM_CPI",
        severity: "MEDIUM",
        instructionIndex: instruction.index,
        detail: `Instruction ${instruction.index} calls unknown program ${shorten(instruction.programId)}.`,
        evidence: { programId: instruction.programId }
      });
      continue;
    }

    if (instruction.name === "SetComputeUnitLimit") {
      computeUnitLimit = Number(instruction.params?.units ?? computeUnitLimit);
    }
    if (instruction.name === "SetComputeUnitPrice") {
      computeUnitPriceMicroLamports = BigInt(String(instruction.params?.microLamports ?? "0"));
    }

    findings.push(...scanTokenInstruction(instruction, context, policy));
    findings.push(...scanProgramUpgrade(instruction));
  }

  const estimatedPriorityFeeLamports = Number((BigInt(computeUnitLimit) * computeUnitPriceMicroLamports) / 1_000_000n);
  if (estimatedPriorityFeeLamports > policy.limits.maxPriorityFeeLamports) {
    findings.push({
      id: "PRIORITY_FEE_DRAIN",
      severity: "MEDIUM",
      detail: `Estimated priority fee is ${estimatedPriorityFeeLamports} lamports, above policy cap ${policy.limits.maxPriorityFeeLamports}.`,
      evidence: {
        computeUnitLimit,
        computeUnitPriceMicroLamports: computeUnitPriceMicroLamports.toString(),
        estimatedPriorityFeeLamports
      }
    });
  }

  return findings;
}

function scanTokenInstruction(
  instruction: DecodedInstruction,
  context: TransactionContext,
  policy: PolicyConfig
): Finding[] {
  if (instruction.programId !== PROGRAMS.token && instruction.programId !== PROGRAMS.token2022) {
    return [];
  }

  const params = instruction.params ?? {};
  const findings: Finding[] = [];

  if (instruction.name === "Approve" || instruction.name === "ApproveChecked") {
    const amount = BigInt(String(params.amount ?? "0"));
    const delegate = String(params.delegate ?? "unknown");
    const unlimited = amount === U64_MAX;
    const delegateAllowlisted = isProgramAllowlisted(delegate, policy.programs.allow);
    findings.push({
      id: "UNLIMITED_APPROVE",
      severity: unlimited && policy.approvals.blockUnlimited ? "CRITICAL" : delegateAllowlisted ? "LOW" : "MEDIUM",
      instructionIndex: instruction.index,
      detail: unlimited
        ? `Approves unlimited token allowance to ${shorten(delegate)}.`
        : `Approves ${amount.toString()} token units to ${shorten(delegate)}.`,
      evidence: { delegate, amount: amount.toString(), unlimited }
    });
  }

  if (instruction.name === "SetAuthority") {
    const authorityType = String(params.authorityType ?? "unknown");
    const newAuthority = params.newAuthority === null ? null : String(params.newAuthority ?? "unknown");
    if (authorityType === "MintTokens" || authorityType === "FreezeAccount") {
      findings.push({
        id: "MINT_FREEZE_HANDOFF",
        severity: newAuthority === null ? "LOW" : "CRITICAL",
        instructionIndex: instruction.index,
        detail:
          newAuthority === null
            ? `Burns ${authorityType} authority.`
            : `Hands ${authorityType} authority to ${shorten(newAuthority)}.`,
        evidence: { authorityType, newAuthority }
      });
    }
    if (authorityType === "AccountOwner") {
      findings.push({
        id: "ACCOUNT_OWNER_CHANGE",
        severity: "HIGH",
        instructionIndex: instruction.index,
        detail: `Changes token-account owner to ${shorten(newAuthority ?? "none")}.`,
        evidence: { authorityType, newAuthority }
      });
    }
  }

  if (instruction.name === "CloseAccount") {
    const destination = String(params.destination ?? "unknown");
    const destinationIsSigner = context.signerKeys.includes(destination);
    findings.push({
      id: "ACCOUNT_CLOSE_DRAIN",
      severity: destinationIsSigner ? "INFO" : "HIGH",
      instructionIndex: instruction.index,
      detail: destinationIsSigner
        ? "Closes a token account and returns rent to the signer."
        : `Closes a token account and sends rent to ${shorten(destination)}.`,
      evidence: { destination }
    });
  }

  if (instruction.name === "Burn" || instruction.name === "BurnChecked") {
    findings.push({
      id: "TOKEN_BURN",
      severity: "MEDIUM",
      instructionIndex: instruction.index,
      detail: `Burns ${String(params.amount ?? "unknown")} token units from a signer-controlled account.`,
      evidence: params
    });
  }

  return findings;
}

function scanProgramUpgrade(instruction: DecodedInstruction): Finding[] {
  if (instruction.programId !== PROGRAMS.bpfUpgradeable) {
    return [];
  }
  if (instruction.name === "Upgrade" || instruction.name === "SetAuthority" || instruction.name === "SetAuthorityChecked") {
    return [
      {
        id: "PROGRAM_UPGRADE",
        severity: "HIGH",
        instructionIndex: instruction.index,
        detail: `BPF upgradeable loader instruction ${instruction.name} appears in this transaction.`,
        evidence: instruction.params
      }
    ];
  }
  return [];
}
