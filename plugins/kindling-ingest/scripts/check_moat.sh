#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

DENY='app\.agentic|global_skills|from app |import app|MEMORY_INTAKE|CODEX_SYSTEM_PROMPT|[^a-z]SYSTEM_PROMPT|customer-brief-craft|editor-brief-craft|founder-voice-setup|social-content-craft|strategic-content-ideas|timeline-strategy-qa|video-script-mastery|videographer-brief-craft|written-script-mastery|strategy-generator|mcp_live_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'

if rg -n -i "$DENY" "$PLUGIN_DIR" --glob '!**/check_moat.sh'; then
  echo "moat check failed: internal or secret-like material found in plugin" >&2
  exit 1
fi

if find "$PLUGIN_DIR" -type f \( -name '*.pyc' -o -name '.DS_Store' \) -print | grep -q .; then
  echo "moat check failed: generated host files found in plugin" >&2
  exit 1
fi

echo "moat check passed: $PLUGIN_DIR"
