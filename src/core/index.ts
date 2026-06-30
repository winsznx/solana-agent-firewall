import { enrichTransaction, enrichmentFindings } from "./enrich.js";
import { ingestTransaction } from "./ingest.js";
import { reconcileIntent } from "./intent.js";
import { evaluatePolicy } from "./policy-eval.js";
import { mergePolicy } from "./policy.js";
import { makeConnection } from "./rpc.js";
import { simulateAndDiff } from "./simulate.js";
import { staticScan } from "./static-scan.js";
import type { EnrichmentResult, FirewallInput, FirewallResult } from "./types.js";
import { blockForParseError, synthesizeVerdict } from "./verdict.js";

export async function firewallCheck(input: FirewallInput): Promise<FirewallResult> {
  const policy = mergePolicy(input.policy);
  const connection = makeConnection(input.rpcUrl);

  try {
    const ingested = await ingestTransaction(input.tx, connection, policy.programs.allow);
    const staticFindings = staticScan(ingested.context, policy);
    const enrich = await safeEnrich(ingested.context, connection, policy);
    const enrichment = enrichmentFindings(enrich, policy);
    const simulation = await simulateAndDiff(ingested.transaction, ingested.context, connection);
    const intent = reconcileIntent(input.intent, ingested.context, simulation);
    const intentFindings =
      intent.provided && intent.matches === false
        ? intent.divergences.map((detail) => ({
            id: "INTENT_MISMATCH" as const,
            severity: "HIGH" as const,
            detail,
            evidence: { claimed: intent.claimed }
          }))
        : [];
    const findings = [...ingested.preflightFindings, ...staticFindings, ...enrichment, ...intentFindings];
    const policyEval = evaluatePolicy(ingested.context, findings, simulation, policy);
    return synthesizeVerdict({
      context: ingested.context,
      findings,
      policy: policyEval,
      simulation,
      intent,
      enrich
    });
  } catch (error) {
    return blockForParseError(error instanceof Error ? error.message : String(error));
  }
}

async function safeEnrich(
  context: Awaited<ReturnType<typeof ingestTransaction>>["context"],
  connection: ReturnType<typeof makeConnection>,
  policy: ReturnType<typeof mergePolicy>
): Promise<EnrichmentResult> {
  try {
    return await enrichTransaction(context, connection, policy);
  } catch (error) {
    return {
      ran: false,
      unknownChecks: [`rpc-enrich-failed: ${error instanceof Error ? error.message : String(error)}`],
      mints: [],
      programs: []
    };
  }
}

export * from "./types.js";
export { DEFAULT_POLICY, mergePolicy } from "./policy.js";
