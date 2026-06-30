#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { FirewallInput } from "./core/index.js";
import { suppressKnownSolanaNativeFallbackWarning } from "./warnings.js";

suppressKnownSolanaNativeFallbackWarning();
const { firewallCheck } = await import("./core/index.js");

const server = new Server(
  {
    name: "solana-agent-firewall",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "firewall_check",
      description:
        "Inspect an unsigned serialized Solana transaction before signing and return ALLOW/WARN/BLOCK with findings.",
      inputSchema: {
        type: "object",
        properties: {
          tx: {
            type: "string",
            description: "Base64 serialized unsigned Solana transaction."
          },
          intent: {
            type: "string",
            description: "Optional stated intent, e.g. 'swap 1 SOL for USDC on Jupiter'."
          },
          policy: {
            type: "object",
            description: "Optional policy override merged over built-in defaults."
          },
          rpcUrl: {
            type: "string",
            description: "Optional Solana RPC URL. Defaults to SOLANA_RPC_URL."
          },
          cluster: {
            type: "string",
            enum: ["mainnet", "devnet"],
            description: "Cluster label."
          }
        },
        required: ["tx"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "firewall_check") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
  const args = request.params.arguments;
  if (!args || typeof args !== "object" || typeof args.tx !== "string") {
    throw new Error("firewall_check requires { tx: string }");
  }
  const input = args as unknown as FirewallInput;
  const result = await firewallCheck(input);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
});

await server.connect(new StdioServerTransport());
