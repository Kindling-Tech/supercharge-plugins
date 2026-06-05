# Supercharge Plugins

Official Supercharge plugins for AI coding agents — **Claude Code**, **Cursor**, and **Codex**.

This repository is a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) (`.claude-plugin/marketplace.json`).

## Plugins

### `supercharge-ingest`

Save knowledge to your Supercharge knowledge base automatically. Connects your
agent to the Supercharge ingestion MCP server, and adds a `knowledge-ingest`
skill plus an auto-ingest hook so the agent saves on clear intent ("remember
this…") without being asked.

**Claude Code**

```bash
/plugin marketplace add Kindling-Tech/supercharge-plugins
/plugin install supercharge-ingest@supercharge
```

**Cursor / Codex** and full setup (including getting your token): see
[`supercharge-ingest/INSTALL.md`](supercharge-ingest/INSTALL.md) and
[`supercharge-ingest/DISTRIBUTION.md`](supercharge-ingest/DISTRIBUTION.md).

## Notes

- You need a Supercharge account; get your MCP URL + bearer token from the app.
- These packages contain no server-side code — only client config, a skill, and
  a hook (`supercharge-ingest/scripts/check_moat.sh` enforces this).
