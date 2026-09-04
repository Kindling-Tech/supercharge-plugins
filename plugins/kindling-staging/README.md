# Kindling Staging

Kindling Staging is an internal dual-host plugin for Codex and Claude Code. It
connects only the non-production MCP server:

- `https://api.staging.kindling.team/mcp`

The OAuth server is hosted on the staging API origin and sends browser consent
to `https://app.staging.kindling.team`. No production Kindling endpoint is used.

## Components

- `kindling-staging-mcp` for explicit staging recall and knowledge operations.
- `kindling-staging-source-ingestion` for reviewed staging ingestion.
- The same deterministic filtering and approval guardrails as production.
- Staging-specific OAuth server names, reports, approvals, and audit ledgers.

The customer policy remains at `.kindling/ingestion-policy.yaml`. Staging state
is isolated under `.kindling/reports/staging/` and `.kindling/state/staging/`.
Production and staging can therefore be installed together without sharing
approval receipts or write state.

Staging skills do not invoke implicitly. The user must explicitly select the
staging skill or ask to test against Kindling Staging.

See [`INSTALL.md`](INSTALL.md) for setup and
[`DISTRIBUTION.md`](DISTRIBUTION.md) for release checks.
