# Kindling

Kindling is a dual-host plugin for Codex and Claude Code. It connects two
existing OAuth MCP servers:

- Kindling workspace: `https://api.kindling.team/mcp`
- Granola: `https://mcp.granola.ai/mcp`

The plugin does not run or proxy either service.

## Components

- Two Agent Skills: safe source ingestion and Kindling knowledge MCP usage.
- A customer-maintained `.kindling/ingestion-policy.yaml`.
- A deterministic local review/report runtime.
- Shared `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and
  `PostToolUseFailure` hooks.
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

- Raw Granola notes and transcripts are not stored by the plugin.
- Reports persist only candidate content that passed deterministic filtering.
- Withheld content is represented by rule identifiers and counts.
- Ledgers store hashes, IDs, status, and timestamps, not content.
- Meeting IDs are HMACed with a local random key.
- Credentials are managed by each MCP server's browser OAuth flow.

The selected Codex or Claude model necessarily receives the Granola content it
is asked to review. The filtering boundary is before Kindling ingestion, not
before the host model processes the source.

## Limitation

The plugin controls writes made through its own normal MCP workflow. It cannot
disable or govern a separate background integration a customer may have enabled
outside this plugin.

See [`INSTALL.md`](INSTALL.md) for setup and [`DISTRIBUTION.md`](DISTRIBUTION.md)
for release operations.
