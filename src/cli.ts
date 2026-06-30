#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import type { FirewallInput, FirewallResult, PolicyConfig } from "./core/index.js";
import { suppressKnownSolanaNativeFallbackWarning } from "./warnings.js";

suppressKnownSolanaNativeFallbackWarning();
const { firewallCheck } = await import("./core/index.js");

const program = new Command();

program
  .name("firewall")
  .description("Pre-sign Solana transaction firewall for agents, humans, and CI.")
  .version("0.1.0");

program
  .command("check")
  .argument("<tx>", "base64 transaction string or path to a file containing one")
  .description("Inspect an unsigned serialized Solana transaction before signing.")
  .option("-i, --intent <intent>", "stated human/agent intent to compare against the transaction")
  .option("-p, --policy <path>", "path to a policy JSON file")
  .option("-r, --rpc-url <url>", "Solana RPC URL; falls back to SOLANA_RPC_URL")
  .option("-c, --cluster <cluster>", "cluster label for output", "mainnet")
  .option("--json", "print raw verdict JSON")
  .action(async (txArg: string, options: Record<string, string | boolean>) => {
    const input: FirewallInput = {
      tx: readTxArg(txArg),
      intent: typeof options.intent === "string" ? options.intent : undefined,
      policy: typeof options.policy === "string" ? readPolicy(options.policy) : undefined,
      rpcUrl: typeof options.rpcUrl === "string" ? options.rpcUrl : undefined,
      cluster: options.cluster === "devnet" ? "devnet" : "mainnet"
    };
    const result = await firewallCheck(input);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      renderResult(result);
    }
    process.exitCode = result.verdict === "BLOCK" ? 2 : result.verdict === "WARN" ? 1 : 0;
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});

function readTxArg(value: string): string {
  const path = resolve(value);
  if (existsSync(path)) {
    return readFileSync(path, "utf8").trim();
  }
  return value.trim();
}

function readPolicy(path: string): Partial<PolicyConfig> {
  return parseJsonObject<Partial<PolicyConfig>>(readFileSync(resolve(path), "utf8"));
}

function parseJsonObject<T>(value: string): T {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as T;
}

function renderResult(result: FirewallResult): void {
  const color = result.verdict === "ALLOW" ? ansi.green : result.verdict === "WARN" ? ansi.yellow : ansi.red;
  console.log(`${color}${result.verdict}${ansi.reset}  confidence=${result.confidence}`);
  console.log(result.summary);
  console.log("");
  console.log(`tx: version=${result.transaction.version} feePayer=${result.transaction.feePayer}`);
  console.log(`instructions=${result.transaction.instructionCount} altResolved=${result.transaction.altResolved}`);
  console.log(`effects: SOL ${result.effects.solDelta}`);
  if (result.effects.tokenDeltas.length > 0) {
    for (const delta of result.effects.tokenDeltas) {
      console.log(`  token ${delta.mint ?? "unknown"} ${delta.deltaUi ?? delta.deltaRaw} account=${delta.account}`);
    }
  }
  if (result.intent.provided) {
    console.log(`intent: ${result.intent.matches ? "matches" : "mismatch"} - ${result.intent.claimed}`);
  }
  if (result.findings.length > 0) {
    console.log("");
    console.log("findings:");
    for (const finding of result.findings) {
      const severityColor =
        finding.severity === "CRITICAL" ? ansi.red : finding.severity === "HIGH" ? ansi.yellow : ansi.dim;
      const index = finding.instructionIndex === undefined ? "" : ` ix=${finding.instructionIndex}`;
      console.log(`  ${severityColor}${finding.severity}${ansi.reset} ${finding.id}${index} - ${finding.detail}`);
    }
  }
  if (result.simulation.ran) {
    console.log("");
    console.log(
      `simulation: ${result.simulation.success ? "success" : "failed"} cu=${result.simulation.computeUnits ?? "unknown"}`
    );
  }
}

const ansi = {
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  dim: "\u001b[2m",
  reset: "\u001b[0m"
};
