# Distribution — how a customer adds `supercharge-ingest` to their agent

This explains (1) what we publish so customers can install, and (2) the exact
steps a customer runs for Claude Code, Cursor, and Codex.

## The model (three pieces)

1. **The MCP server** — already live and customer-reachable at `https://api.supercharge.so/mcp` (Streamable HTTP, bearer auth, per-request tenant resolution). Nothing to deploy.
2. **The plugin package** — published as a **public marketplace repo: `Kindling-Tech/supercharge-plugins`** (this package). Public is required so customers can `/plugin marketplace add Kindling-Tech/supercharge-plugins`. It is clean-room: config + a skill + a hook, no backend code (enforced by `scripts/check_moat.sh`).
3. **Per-customer credentials** — each customer gets their own URL + `mcp_live_…` token from the Supercharge app (`GET /companies/{id}/mcp/server-info` + credential reveal in Connect Hub). The package never contains a token; it reads `SUPERCHARGE_MCP_URL` / `SUPERCHARGE_MCP_TOKEN` from the environment.

So "can a customer add our plugin?" → **yes**, once (2) is published publicly and the customer has their token. The server (1) and credentials (3) already exist.

## Claude Code

```bash
# one-time
export SUPERCHARGE_MCP_URL="https://api.supercharge.so/mcp"
export SUPERCHARGE_MCP_TOKEN="mcp_live_xxx"        # from the Supercharge app

# in Claude Code
/plugin marketplace add Kindling-Tech/supercharge-plugins
/plugin install supercharge-ingest@supercharge
/reload-plugins
```

`supercharge` is the marketplace name (the `name` in `marketplace.json`); `supercharge-ingest` is the plugin. Installing loads the MCP server, the `knowledge-ingest` skill, and the `UserPromptSubmit` auto-ingest hook. Verify with `/mcp`.

**Team / org rollout** — commit this to the customer's repo `.claude/settings.json`; on folder-trust Claude Code prompts to install:

```json
{
  "extraKnownMarketplaces": {
    "supercharge": {
      "source": { "source": "github", "repo": "Kindling-Tech/supercharge-plugins" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": ["supercharge-ingest@supercharge"]
}
```

(See `code.claude.com/docs/en/settings#plugin-settings` for the exact `enabledPlugins` shape; a known Claude Code issue means some versions don't auto-prompt — users may run `/plugin install` once.)

## Cursor

**One-click (recommended).** Generate a per-customer "Add to Cursor" deeplink (the token is embedded, so generate it in the authenticated app, not committed):

```bash
python3 scripts/cursor_deeplink.py --url "$SUPERCHARGE_MCP_URL" --token "$SUPERCHARGE_MCP_TOKEN"
# → cursor://anysphere.cursor-deeplink/mcp/install?name=supercharge&config=<base64>
```

Render it as an **Add to Cursor** button in the Supercharge app; clicking it installs the MCP server in one click.

**Manual.** Add the server in Cursor Settings → MCP, or drop `cursor/mcp.json` → `.cursor/mcp.json` and `cursor/rules/knowledge-ingest.mdc` → `.cursor/rules/` in the project. If your Cursor build doesn't expand `${SUPERCHARGE_MCP_URL}`/`${SUPERCHARGE_MCP_TOKEN}`, paste literal values. Cursor has no file-based hooks, so the Always rule + tool descriptions drive proactive saving; teams can also push the rule via the Cursor dashboard.

## Codex

```bash
export SUPERCHARGE_MCP_TOKEN="mcp_live_xxx"
codex mcp add supercharge --url "https://api.supercharge.so/mcp" --bearer-token-env-var SUPERCHARGE_MCP_TOKEN

# proactive "when to ingest" guidance + optional subagent
cat codex/AGENTS.snippet.md >> AGENTS.md
mkdir -p .codex/agents && cp codex/agents/knowledge-ingest.toml .codex/agents/
```

Equivalent manual config is in `codex/config.snippet.toml`. Verify with `/mcp` inside Codex. Org defaults can go in `/etc/codex/config.toml`.

## How we publish / update the package

The repo `Kindling-Tech/supercharge-plugins` is the marketplace:

```
supercharge-plugins/                       (repo root = the marketplace)
├── .claude-plugin/marketplace.json        (lists supercharge-ingest)
└── supercharge-ingest/                    (the plugin)
```

To release an update: edit files, bump `version` in `supercharge-ingest/.claude-plugin/plugin.json`, run `scripts/check_moat.sh` + the test suite, commit, push. Customers with `autoUpdate` pick it up at startup; others run `/plugin marketplace update supercharge`.

Every release must pass `scripts/check_moat.sh` — this repo ships only the clean-room plugin (config + skill + hook), never any server-side code.

## Security

- Plugins/marketplaces run code with the user's privileges — only the clean-room contents here are shipped; `check_moat.sh` blocks internal identifiers.
- Tokens are never committed; they live in env vars (and, for the Cursor deeplink, only in per-customer links generated in the authenticated app). Tokens are revocable in Connect Hub.
