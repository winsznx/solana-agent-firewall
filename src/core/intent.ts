import type { IntentResult, TransactionContext, SimulationResult } from "./types.js";

const PROTOCOL_KEYWORDS: Record<string, string[]> = {
  jupiter: ["jupiter"],
  orca: ["orca", "whirlpool"],
  raydium: ["raydium"],
  meteora: ["meteora", "dlmm"]
};

export function reconcileIntent(
  intent: string | undefined,
  context: TransactionContext,
  simulation: SimulationResult | undefined
): IntentResult {
  if (!intent?.trim()) {
    return { provided: false, divergences: [] };
  }

  const claimed = intent.trim();
  const lower = claimed.toLowerCase();
  const instructionNames = context.decodedInstructions.map((instruction) => instruction.name ?? "");
  const programNames = context.decodedInstructions.map((instruction) => instruction.programName.toLowerCase());
  const divergences: string[] = [];

  for (const [protocol, keywords] of Object.entries(PROTOCOL_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword)) && !programNames.some((program) => program.includes(protocol))) {
      divergences.push(`Intent mentions ${protocol}, but no ${protocol} program appears in the transaction.`);
    }
  }

  const claimsSwap = /\b(swap|trade|buy|sell)\b/.test(lower);
  if (claimsSwap) {
    const suspiciousNames = instructionNames.filter((name) =>
      ["SetAuthority", "CloseAccount", "Upgrade", "SetAuthorityChecked"].includes(name)
    );
    if (suspiciousNames.length > 0) {
      divergences.push(`Intent claims a swap/trade, but transaction includes ${[...new Set(suspiciousNames)].join(", ")}.`);
    }
  }

  const claimsReceive = /\b(receive|get|for)\b/.test(lower);
  if (claimsReceive && simulation?.ran && simulation.success && simulation.tokenDeltas.length === 0 && simulation.solDeltaLamports <= 0) {
    divergences.push("Intent implies receiving value, but simulation did not show signer-side positive token/SOL deltas.");
  }

  return {
    provided: true,
    claimed,
    matches: divergences.length === 0,
    divergences
  };
}
