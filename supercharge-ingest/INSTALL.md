# Install — supercharge-ingest

Connects your AI coding agent to your Supercharge knowledge base so you can save
knowledge by just asking ("remember this…"). Works with Claude Code, Cursor, and Codex.

## 1. Get your credentials

From the Supercharge app (or `GET /companies/{id}/mcp/server-info`):

- **URL** — your `/mcp` endpoint, e.g. `https://api.supercharge.so/mcp`
- **Token** — an `mcp_live_…` bearer token (Connectors → reveal credential)

Set them in your shell:

```bash
export SUPERCHARGE_MCP_URL="https://api.supercharge.so/mcp"
export SUPERCHARGE_MCP_TOKEN="mcp_live_xxx"
```

## 2a. Claude Code (full: MCP + skill + auto-ingest hook)

```bash
/plugin marketplace add Kindling-Tech/supercharge-plugins
/plugin install supercharge-ingest@supercharge
/reload-plugins
```

The plugin auto-loads the `supercharge` MCP server, the `knowledge-ingest` skill,
and a `UserPromptSubmit` hook that saves on clear intent. Verify with `/mcp`.

Team rollout: commit `extraKnownMarketplaces` + `enabledPlugins` to the repo's
`.claude/settings.json` (see DISTRIBUTION.md).

## 2b. Cursor (MCP + Always rule)

**One-click:** generate an "Add to Cursor" deeplink (embeds your token, so keep it private):

```bash
python3 scripts/cursor_deeplink.py --url "$SUPERCHARGE_MCP_URL" --token "$SUPERCHARGE_MCP_TOKEN"
# open the printed cursor://... link
```

**Manual:** copy the templates into your project (Cursor has no file-based hooks, so the
Always rule + tool descriptions drive proactive saving):

```bash
mkdir -p .cursor/rules
cp cursor/mcp.json .cursor/mcp.json
cp cursor/rules/knowledge-ingest.mdc .cursor/rules/
```

If your Cursor build does not expand `${SUPERCHARGE_MCP_URL}` / `${SUPERCHARGE_MCP_TOKEN}`
in `.cursor/mcp.json`, replace them with the literal URL and token.

## 2c. Codex (MCP + AGENTS.md + optional subagent)

```bash
codex mcp add supercharge --url "$SUPERCHARGE_MCP_URL" --bearer-token-env-var SUPERCHARGE_MCP_TOKEN
cat codex/AGENTS.snippet.md >> AGENTS.md
mkdir -p .codex/agents && cp codex/agents/knowledge-ingest.toml .codex/agents/
```

Equivalent manual config is in `codex/config.snippet.toml`. The optional auto-ingest
hook is commented there — verify the `[hooks]` schema for your Codex version before
enabling. Verify the server with `/mcp` inside Codex.

## 3. Try it

> "Remember this: our ICP is seed-stage B2B SaaS founders in fintech."

The agent calls `add_knowledge` and reports the save status. Recall with
"what do we know about our ICP?" (the agent reads via `list_memory_map` / `fetch_memory`).

## Tools

`add_knowledge`, `get_ingestion_status`, `list_memory_map`, `fetch_memory`
(scopes: `knowledge:write`, `knowledge:read`).
