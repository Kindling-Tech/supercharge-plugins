#!/usr/bin/env bash
# Fails (exit 1) if the distributable plugin leaks any internal IP / backend refs.
set -euo pipefail
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Internal identifiers that must NEVER appear in the distributable package.
DENY='app\.agentic|global_skills|from app |import app|MEMORY_INTAKE|CODEX_SYSTEM_PROMPT|[^a-z]SYSTEM_PROMPT|customer-brief-craft|editor-brief-craft|founder-voice-setup|social-content-craft|strategic-content-ideas|timeline-strategy-qa|video-script-mastery|videographer-brief-craft|written-script-mastery|strategy-generator'

# Exclude this script itself (it necessarily contains the denylist).
if grep -RInE "$DENY" "$PLUGIN_DIR" --exclude="check_moat.sh"; then
  echo "MOAT VIOLATION: internal identifiers found in distributable plugin (matches above)." >&2
  exit 1
fi
echo "moat check passed: no internal IP in $PLUGIN_DIR"
