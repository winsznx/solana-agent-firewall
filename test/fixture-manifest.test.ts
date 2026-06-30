import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { firewallCheck, type FirewallResult, type Verdict } from "../src/core/index.js";

type FixtureAssertions = {
  minLookupTableCount?: number;
  noCriticalFindings?: boolean;
  noUnknownProgramFindings?: boolean;
  simulationRan?: boolean;
  simulationSuccess?: boolean;
  solDeltaNegative?: boolean;
  intentMatches?: boolean;
};

type FixtureMeta = {
  name: string;
  expectedVerdict?: Verdict;
  acceptableVerdicts?: Verdict[];
  mustContainFindings?: string[];
  assertions?: FixtureAssertions;
  requiresRpc?: boolean;
  intent?: string;
};

const fixturesDir = resolve("test", "fixtures");
const manifestPath = resolve(fixturesDir, "MANIFEST.json");
const manifest: string[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
const suite = manifest.length > 0 ? describe : describe.skip;

suite("fixture manifest", () => {
  for (const name of manifest) {
    const meta = readJson<FixtureMeta>(resolve(fixturesDir, `${name}.json`));
    const runner = meta.requiresRpc && !process.env.SOLANA_RPC_URL ? it.skip : it;

    runner(`${name}`, async () => {
      const tx = readFileSync(resolve(fixturesDir, `${name}.b64`), "utf8");
      const result = await firewallCheck({
        tx,
        intent: meta.intent,
        rpcUrl: process.env.SOLANA_RPC_URL
      });

      assertVerdict(result, meta);
      assertFindings(result, meta);
      assertStructuralExpectations(result, meta.assertions);
    }, 90_000);
  }
});

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function assertVerdict(result: FirewallResult, meta: FixtureMeta): void {
  if (meta.acceptableVerdicts?.length) {
    expect(meta.acceptableVerdicts).toContain(result.verdict);
    return;
  }
  if (meta.expectedVerdict) {
    expect(result.verdict).toBe(meta.expectedVerdict);
  }
}

function assertFindings(result: FirewallResult, meta: FixtureMeta): void {
  const ids = result.findings.map((finding) => finding.id);
  for (const id of meta.mustContainFindings ?? []) {
    expect(ids).toContain(id);
  }
}

function assertStructuralExpectations(result: FirewallResult, assertions: FixtureAssertions | undefined): void {
  if (!assertions) {
    return;
  }
  if (assertions.minLookupTableCount !== undefined) {
    expect(result.transaction.lookupTableCount).toBeGreaterThanOrEqual(assertions.minLookupTableCount);
    expect(result.transaction.altResolved).toBe(true);
  }
  if (assertions.noCriticalFindings) {
    expect(result.findings.filter((finding) => finding.severity === "CRITICAL")).toEqual([]);
  }
  if (assertions.noUnknownProgramFindings) {
    expect(result.findings.filter((finding) => finding.id === "UNKNOWN_PROGRAM_CPI")).toEqual([]);
    expect(result.transaction.unknownPrograms).toEqual([]);
  }
  if (assertions.simulationRan !== undefined) {
    expect(result.simulation.ran).toBe(assertions.simulationRan);
  }
  if (assertions.simulationSuccess !== undefined) {
    expect(result.simulation.success).toBe(assertions.simulationSuccess);
  }
  if (assertions.solDeltaNegative) {
    expect(result.effects.solDelta.startsWith("-")).toBe(true);
  }
  if (assertions.intentMatches !== undefined) {
    expect(result.intent.matches).toBe(assertions.intentMatches);
  }
}
