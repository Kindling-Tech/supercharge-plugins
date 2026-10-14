# Kindling

Kindling is a dual-host plugin for Codex and Claude Code. It connects one
existing OAuth MCP server:

- Kindling workspace: `https://api.kindling.team/mcp`

The plugin does not run or proxy the service. Knowledge sources are optional:
the ingestion skill may use notes, files, URLs, or connectors the user already
authorized in the host, but none are bundled with or required by this plugin.

## Data flow and network access

The plugin makes no network calls of its own. Every request to Kindling goes
through the host's MCP client to `https://api.kindling.team/mcp`, after the
user signs in through Kindling's browser OAuth flow:

- Read tools (`list_profiles`, `search_memory`, `fetch_memory`,
  `search_sources`, `read_source`, `get_ingestion_status`) send search queries,
  Profile IDs, document paths, and source IDs, and return the connected
  company's Kindling knowledge.
- The write tool (`add_knowledge`) sends only candidate knowledge the user
  approved in a local review report, plus its destination Profile ID when one
  is selected.

Locally, the hooks and skills run the bundled Node.js runtime
(`dist/kindling-guard.cjs`, compiled from `packages/agent-cli/src` in this
repository). It reads the customer policy and writes reports and
metadata-only ledgers under the workspace's `.kindling/` directory. At Claude
Code startup the `SessionStart` hook runs `claude mcp list` to check the
Kindling connection and, only when signed out, starts Claude Code's own MCP
sign-in, which opens the Kindling sign-in page in the browser. Turn this off
with the plugin's `auto_connect` setting. No telemetry is collected. See the [Kindling privacy policy](https://kindling.team/privacy).

## Components

- Two Agent Skills: safe source ingestion and Kindling knowledge MCP usage.
- A customer-maintained `.kindling/ingestion-policy.yaml`.
- A deterministic local review/report runtime.
- A Claude `SessionStart` connection hook plus shared `UserPromptSubmit`,
  `PreToolUse`, `PostToolUse`, and `PostToolUseFailure` hooks.
- Metadata-only local source, approval, sent, and failure ledgers.
- A compiled Node 20+ runtime; Python is not required.

## Safety model

The skill filters for durable information whose exact final wording is safe for
public marketing. The report contains exact `add_knowledge` arguments. The user
approves a report digest and selected candidates. The write hook recomputes the
arguments' digest and denies mismatches before the MCP call.

The hook does not auto-approve valid calls. The host's ordinary tool permission
policy still applies.

## Privacy

- Raw source notes, documents, and transcripts are not stored by the plugin.
- Reports persist only candidate content that passed deterministic filtering.
- Withheld content is represented by rule identifiers and counts.
- Ledgers store hashes, IDs, status, and timestamps, not content.
- Private source record IDs are HMACed with a local random key.
- Credentials are managed by the Kindling MCP's browser OAuth flow.

The selected Codex or Claude model necessarily receives the source content it
is asked to review. The filtering boundary is before Kindling ingestion, not
before the host model processes the source.

## Limitation

The plugin controls writes made through its own normal MCP workflow. It cannot
disable or govern a separate background integration a customer may have enabled
outside this plugin.

See [`INSTALL.md`](INSTALL.md) for setup and [`DISTRIBUTION.md`](DISTRIBUTION.md)
for release operations.
