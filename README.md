# Supercharge Plugins

Official Kindling agent plugins for Codex and Claude Code.

This repository is both:

- a Claude Code marketplace at `.claude-plugin/marketplace.json`; and
- a Codex marketplace at `.agents/plugins/marketplace.json`.

## Kindling

`kindling` connects the existing Kindling remote MCP server and ships exactly
two clean-room skills:

- `kindling-source-ingestion` safely reviews external sources, filters sensitive
  information, formats exact Kindling payloads, requires digest-bound approval,
  and keeps a metadata-only local receipt ledger;
- `kindling-mcp` teaches the public Kindling knowledge tool contract.

The plugin contains no Kindling backend code or private prompt material. See
[`plugins/kindling/README.md`](plugins/kindling/README.md) and
[`plugins/kindling/INSTALL.md`](plugins/kindling/INSTALL.md).

## Kindling Staging

`kindling-staging` is the explicit-only internal testing variant. It connects
`https://api.staging.kindling.team/mcp`, while production continues to connect
`https://api.kindling.team/mcp`. The two plugins have separate MCP names,
skills, reports, approvals, and ledgers and can be installed together.

See [`plugins/kindling-staging/README.md`](plugins/kindling-staging/README.md)
and [`plugins/kindling-staging/INSTALL.md`](plugins/kindling-staging/INSTALL.md).

### Install with the CLI

```bash
npx @kindling/agent install --target all
```

For staging:

```bash
npx @kindling/agent install --target all --environment staging
```

The install command is a dry run unless `--execute` is supplied. Execution
opens Kindling's secure browser sign-in automatically; users do not need to
know an MCP login command.

### Claude Code

```bash
claude plugin marketplace add Kindling-Tech/supercharge-plugins
claude plugin install kindling@supercharge --scope user
```

### Codex

```bash
codex plugin marketplace add Kindling-Tech/supercharge-plugins
codex plugin add kindling@supercharge
```

Install staging alongside production with:

```bash
claude plugin install kindling-staging@supercharge --scope user
codex plugin add kindling-staging@supercharge
```

After installation, start a new session and review/trust the plugin hooks.
Codex requests Kindling authentication during installation. Claude Code asks
whether it should connect, then opens the same browser OAuth flow on startup.
The ingestion skill can use sources the user already connected to the host, but
the plugin does not install or require any source connector.

If you installed the earlier `kindling-ingest@supercharge` build, remove it
before installing `kindling@supercharge`; plugin IDs are cache and namespace
bound, so this rename is intentionally a new installation.

## Legacy plugin

The `supercharge-ingest` source is retained temporarily for historical
compatibility and regression tests, but it is no longer listed in either active
marketplace because it does not implement the reviewed-ingestion policy.

## Development

```bash
npm install
npm run check
```

The detailed internal build task is tracked in
[`docs/tasks/2026-08-31-kindling-plugin.md`](docs/tasks/2026-08-31-kindling-plugin.md).
