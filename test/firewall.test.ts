import { Keypair, SystemProgram } from "@solana/web3.js";
import { describe, expect, it, beforeEach } from "vitest";
import { firewallCheck } from "../src/core/index.js";
import {
  closeToAttackerInstruction,
  mintAuthorityHandoffInstruction,
  serializeUnsigned,
  unknownProgramInstruction,
  unlimitedApproveInstruction
} from "./helpers.js";

describe("solana-agent-firewall", () => {
  beforeEach(() => {
    delete process.env.SOLANA_RPC_URL;
  });

  it("blocks an unlimited approve and close-account drain transaction", async () => {
    const payer = Keypair.generate();
    const tx = serializeUnsigned(
      [unlimitedApproveInstruction(payer.publicKey), closeToAttackerInstruction(payer.publicKey)],
      payer
    );

    const result = await firewallCheck({ tx });

    expect(result.verdict).toBe("BLOCK");
    expect(result.findings.some((finding) => finding.id === "UNLIMITED_APPROVE" && finding.severity === "CRITICAL")).toBe(
      true
    );
    expect(result.findings.some((finding) => finding.id === "ACCOUNT_CLOSE_DRAIN" && finding.severity === "HIGH")).toBe(
      true
    );
  });

  it("flags intent mismatch when a claimed swap mutates mint authority", async () => {
    const payer = Keypair.generate();
    const tx = serializeUnsigned([mintAuthorityHandoffInstruction(payer.publicKey)], payer);

    const result = await firewallCheck({ tx, intent: "swap 1 SOL for USDC on Jupiter" });

    expect(result.verdict).toBe("BLOCK");
    expect(result.findings.some((finding) => finding.id === "INTENT_MISMATCH")).toBe(true);
    expect(result.findings.some((finding) => finding.id === "MINT_FREEZE_HANDOFF")).toBe(true);
  });

  it("blocks unknown programs when policy denyUnknown is enabled", async () => {
    const payer = Keypair.generate();
    const tx = serializeUnsigned([unknownProgramInstruction(payer.publicKey)], payer);

    const result = await firewallCheck({ tx, policy: { programs: { allow: [], deny: [], denyUnknown: true } } });

    expect(result.verdict).toBe("BLOCK");
    expect(result.policy.violations.some((finding) => finding.id === "UNKNOWN_PROGRAM_CPI")).toBe(true);
  });

  it("blocks unparseable transaction input", async () => {
    const result = await firewallCheck({ tx: "not-base64" });

    expect(result.verdict).toBe("BLOCK");
    expect(result.findings[0]?.id).toBe("UNPARSEABLE");
  });

  it("degrades an otherwise clean transaction to WARN/LOW when RPC is unavailable", async () => {
    const payer = Keypair.generate();
    const recipient = Keypair.generate();
    const tx = serializeUnsigned(
      [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 1_000
        })
      ],
      payer
    );

    const result = await firewallCheck({ tx });

    expect(result.verdict).toBe("WARN");
    expect(result.confidence).toBe("LOW");
    expect(result.findings.some((finding) => finding.id === "RPC_UNAVAILABLE")).toBe(true);
    expect(result.simulation.ran).toBe(false);
  });
});
