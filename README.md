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

## Updates

Production and staging are versioned together. Every release uses one explicit
semantic version across the npm package and both Codex and Claude plugin
manifests.

Codex automatically checks configured Git marketplaces at startup and refreshes
installed plugin caches when the marketplace changes. Start a new task to load
the complete new version. To force an immediate refresh:

```bash
codex plugin marketplace upgrade supercharge
codex plugin add kindling@supercharge
codex plugin add kindling-staging@supercharge
```

Claude Code supports startup auto-updates, but disables them by default for
third-party marketplaces. Enable it once from `/plugin` > Marketplaces >
`supercharge` > Enable auto-update. To update immediately:

```bash
claude plugin marketplace update supercharge
claude plugin update kindling@supercharge --scope user
claude plugin update kindling-staging@supercharge --scope user
```

Restart the host or open a new task/session after updating. A marketplace push
without a manifest version bump is intentionally ignored, so the release gate
checks that all manifest, package, and lockfile versions agree.

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
