# Install — supercharge-ingest

Save knowledge to your Supercharge knowledge base by just asking ("remember
this…"), from Claude Code, Cursor, or Codex. Setup is **one-time** — your token
is stored by the agent, with no environment variables to re-set.

## 1. Get your credentials (Supercharge app → Connectors)

- **URL** — your `/mcp` endpoint, e.g. `https://api.supercharge.so/mcp`
- **Token** — an `mcp_live_…` bearer token (reveal it once)

The dashboard can generate ready-to-paste commands and a one-click Cursor link
with these already filled in.

## 2. Claude Code

Connect once (the token is saved into Claude Code's user config, every project):

```bash
claude mcp add supercharge --scope user --transport http \
  --url "https://api.supercharge.so/mcp" \
  --header "Authorization: Bearer mcp_live_xxx"
```

Then, inside Claude Code, add the auto-save plugin (skill + hook):

```text
/plugin marketplace add Kindling-Tech/supercharge-plugins
/plugin install supercharge-ingest@supercharge
```

Verify with `/mcp`. Team rollout: see DISTRIBUTION.md.

## 3. Cursor

**One-click:** use the **Add to Cursor** button in the Supercharge app (installs
the server with your token built in). Then drop `cursor/rules/knowledge-ingest.mdc`
into `.cursor/rules/` to turn on auto-save guidance.

**Manual:** copy `cursor/mcp.json` → `.cursor/mcp.json` (replace the placeholders
with your URL + token) and copy the rule as above.

## 4. Codex

Add once to `~/.codex/config.toml` (token inline — no env var):

```toml
[mcp_servers.supercharge]
url = "https://api.supercharge.so/mcp"
http_headers = { Authorization = "Bearer mcp_live_xxx" }
```

Then append `codex/AGENTS.snippet.md` to your `AGENTS.md` for auto-save guidance
(optionally copy `codex/agents/knowledge-ingest.toml` into `.codex/agents/`).

## 5. Try it

> "Remember this: our ICP is seed-stage B2B SaaS founders in fintech."

The agent calls `add_knowledge` and reports the status. Recall with "what do we
know about our ICP?" (it reads via `list_memory_map` / `fetch_memory`).

## Notes

- **"Plugin" is Claude Code's packaging name.** Cursor's equivalent is a **rule**;
  Codex's is **AGENTS.md / a skill**. The MCP server itself ships "when to save"
  guidance, so proactive saving works on all three the moment you connect.
- This package ships **no token and no server-side code** — only a skill and a hook.

## Tools (from the `supercharge` MCP server)

`add_knowledge`, `get_ingestion_status`, `list_memory_map`, `fetch_memory`
(scopes: `knowledge:write`, `knowledge:read`).
