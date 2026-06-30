#!/usr/bin/env bash
set -euo pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install pnpm, then rerun ./install.sh"
  exit 1
fi

pnpm install
pnpm build

echo "Installed solana-agent-firewall."
echo "CLI: pnpm firewall check <tx-or-file>"
echo "MCP: pnpm mcp"

if [[ -n "${SKILL_INSTALL_DIR:-}" ]]; then
  mkdir -p "$SKILL_INSTALL_DIR/solana-agent-firewall"
  cp -R skill/. "$SKILL_INSTALL_DIR/solana-agent-firewall/"
  echo "Skill installed to $SKILL_INSTALL_DIR/solana-agent-firewall"
fi
