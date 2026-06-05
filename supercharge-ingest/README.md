# supercharge-ingest

Save knowledge to your Supercharge knowledge base from **Claude Code**, **Cursor**,
and **Codex** — just by asking ("remember this…"). The plugin adds a
`knowledge-ingest` skill and an auto-ingest hook that fire on clear intent and
call the `supercharge` MCP `add_knowledge` tool; writes are reviewed/compiled
server-side.

- **Tools (from the `supercharge` MCP server):** `add_knowledge`, `get_ingestion_status`, `list_memory_map`, `fetch_memory`
- **Skill:** `knowledge-ingest` — Cursor equivalent: `cursor/rules/*.mdc`; Codex: `codex/AGENTS.snippet.md`
- **Hook:** `hooks/detect_ingest_intent.py` (Claude Code / Codex `UserPromptSubmit`)

## One-time setup

1. **Connect the `supercharge` MCP server once** — your token is saved by the
   agent (Claude Code config / Cursor / `~/.codex/config.toml`). No env vars.
2. Add the per-agent auto-save piece (Claude Code plugin, Cursor rule, Codex AGENTS).

See [`INSTALL.md`](INSTALL.md). The MCP server also ships its own "when to save"
instructions, so proactive saving works as soon as you connect.

> "Plugin" is Claude Code's packaging concept; Cursor uses **rules** and Codex
> uses **skills / AGENTS.md** — same outcome, native to each tool.

This package contains no server-side code and no token — only a skill and a hook
(`scripts/check_moat.sh` enforces this).
