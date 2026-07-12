#!/usr/bin/env bash
# Generates MCP configuration for AI tools from .agent/ source of truth.
#
# Source layout (under .agent/):
#   config/mcp/source.json        - canonical MCP server definitions
#
# Generated outputs:
#   .claude/settings.json          - MCP config for Claude Code
#   .opencode/opencode.json        - MCP config for opencode
#
# Each AI tool (Claude, opencode, Cursor, Kiro) generates its own
# commands/ and skills/ directories. This script only creates the
# MCP configuration files.
#
# Re-run after editing .agent/config/mcp/source.json:
#   bash scripts/setup-agent.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- MCP source-of-truth generator ---
MCP_SOURCE=".agent/config/mcp/source.json"

if [[ ! -f "$MCP_SOURCE" ]]; then
  echo "ERROR: $MCP_SOURCE not found" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  # jq is only needed for the local dev agent config. In environments without
  # it (Vercel, CI, etc.) skip generation instead of failing the install.
  echo "⚠ jq not found; skipping MCP config generation (dev-only)." >&2
  exit 0
fi

# Translate one server entry from the neutral source into Claude Code format.
# Context7 is canonical remote (mcp.context7.com). Claude Code here uses the
# stdio+npx shim because that is what is installed and tested locally; we keep
# that working. New servers added to the source can extend this branch.
to_claude_entry() {
  local name="$1"
  case "$name" in
    context7)
      printf '    "%s": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["-y", "@upstash/context7-mcp"]\n    }' "$name"
      ;;
    *)
      echo "ERROR: no Claude adapter for MCP server '$name' in $MCP_SOURCE" >&2
      exit 1
      ;;
  esac
}

CLAUDE_MCP='{'
first=1
while IFS= read -r name; do
  [[ $first -eq 1 ]] && first=0 || CLAUDE_MCP+=','
  CLAUDE_MCP+='
'"$(to_claude_entry "$name")"
done < <(jq -r '.servers | keys[]' "$MCP_SOURCE")
CLAUDE_MCP+='
}'

CLAUDE_SETTINGS="{
  \"mcpServers\": ${CLAUDE_MCP}
}"

# Generate Claude Code settings.json
mkdir -p .claude
rm -f .claude/settings.json
printf '%s\n' "$CLAUDE_SETTINGS" | jq . > .claude/settings.json

# --- opencode: native config at project root ---
OPENCODE_CONFIG='{
  "$schema": "https://opencode.ai/config.json",
  "mcp": '"$(jq '.servers' "$MCP_SOURCE")"'
}'

mkdir -p .opencode
printf '%s\n' "$OPENCODE_CONFIG" | jq . > .opencode/opencode.json

echo "✓ .claude/settings.json generated from $MCP_SOURCE"
echo "✓ .opencode/opencode.json generated from $MCP_SOURCE"
