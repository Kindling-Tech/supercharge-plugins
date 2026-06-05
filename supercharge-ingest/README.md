# supercharge-ingest

A clean-room plugin that connects Claude Code, Cursor, and Codex to your
Supercharge knowledge base. Save knowledge just by asking — an auto-ingest hook
(Claude Code/Codex) and an Always rule (Cursor) call the `add_knowledge` MCP tool
on clear intent; writes are reviewed and compiled server-side.

- **MCP server:** `supercharge` (Streamable HTTP, bearer auth)
- **Tools:** `add_knowledge`, `get_ingestion_status`, `list_memory_map`, `fetch_memory`
- **Skill:** `knowledge-ingest`
- **Hook:** `hooks/detect_ingest_intent.py` (UserPromptSubmit)

See `INSTALL.md` to set up. This package contains no Supercharge backend code or
internal prompts — only the public tool contract (enforced by `scripts/check_moat.sh`).
