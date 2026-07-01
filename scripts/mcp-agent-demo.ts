import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type FixtureCase = {
  name: string;
  intent?: string;
  agentGoal: string;
};

const cases: FixtureCase[] = [
  {
    name: "transfer-allow",
    agentGoal: "A user asks the agent to sign a clean SOL transfer."
  },
  {
    name: "drain-approve-close",
    agentGoal: "A malicious app asks the agent to approve and close a token account."
  },
  {
    name: "intent-mismatch-setauthority",
    intent: "swap 1 SOL for USDC on Jupiter",
    agentGoal: "A user claims this transaction is a Jupiter swap."
  }
];

const client = new Client({ name: "solana-agent-firewall-demo", version: "0.1.0" }, { capabilities: {} });
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/mcp.js"],
  env: {
    ...process.env,
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"
  }
});

await client.connect(transport);
const tools = await client.listTools();
console.log(`Agent connected to MCP tools: ${tools.tools.map((tool) => tool.name).join(", ")}`);

for (const fixture of cases) {
  const tx = readFileSync(`test/fixtures/${fixture.name}.b64`, "utf8");
  console.log("\n---");
  console.log(`Agent goal: ${fixture.agentGoal}`);
  console.log(`Agent action: calling firewall_check on ${fixture.name}.b64`);

  const response = await client.callTool({
    name: "firewall_check",
    arguments: {
      tx,
      intent: fixture.intent
    }
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
  const result = JSON.parse(text) as {
    verdict: "ALLOW" | "WARN" | "BLOCK";
    confidence: string;
    summary: string;
    effects: { solDelta: string };
    findings: Array<{ id: string; severity: string; detail: string }>;
  };

  console.log(`firewall_check verdict: ${result.verdict} (${result.confidence})`);
  console.log(`summary: ${result.summary}`);
  console.log(`signer SOL delta: ${result.effects.solDelta}`);

  const topFindings = result.findings.slice(0, 3);
  if (topFindings.length > 0) {
    console.log("top findings:");
    for (const finding of topFindings) {
      console.log(`- ${finding.severity} ${finding.id}: ${finding.detail}`);
    }
  }

  console.log(`agent decision: ${decisionFor(result.verdict)}`);
}

await client.close();

function decisionFor(verdict: "ALLOW" | "WARN" | "BLOCK"): string {
  if (verdict === "ALLOW") {
    return "continue only if local policy permits automatic signing";
  }
  if (verdict === "WARN") {
    return "do not auto-sign; escalate to a human";
  }
  return "refuse to sign";
}
