# Install Kindling

## Requirements

- Node.js 20 or newer for the local guard runtime.
- A Kindling account with access to the intended workspace.
- A Granola account with meeting notes.
- Codex or Claude Code with plugin, hook, Streamable HTTP MCP, and browser OAuth
  support.

No API token, OAuth client secret, or environment variable is required.

## Rename migration

If the previous plugin ID is installed, remove it first:

```bash
claude plugin uninstall kindling-ingest@supercharge
codex plugin remove kindling-ingest@supercharge
```

Then install `kindling@supercharge` using the instructions below. Existing
project `.kindling/` policy and audit data are not tied to the plugin ID and are
preserved.

## Install with `npx`

Preview both host installations:

```bash
npx @kindling/agent install --target all
```

Execute after reviewing the commands:

```bash
npx @kindling/agent install --target all --execute
```

Non-interactive execution also requires `--yes`.

## Claude Code

```bash
claude plugin marketplace add Kindling-Tech/supercharge-plugins
claude plugin install kindling@supercharge --scope user
```

Start a new Claude Code session. Then:

1. Run `/plugins` and confirm `kindling@supercharge` is enabled.
2. Run `/hooks`, inspect the four plugin hooks, and trust them.
3. Run `/mcp`, approve the plugin-provided Kindling and Granola servers, and
   complete both browser OAuth flows.
4. Run `/kindling:kindling-source-ingestion cold-start`.

Validate a local checkout during development:

```bash
claude plugin validate ./plugins/kindling
claude --plugin-dir ./plugins/kindling
```

## Codex

```bash
codex plugin marketplace add Kindling-Tech/supercharge-plugins
codex plugin add kindling@supercharge
```

Start a new Codex task so it loads the installed plugin. Review and trust the
plugin hooks, authenticate both remote MCP servers when prompted, then invoke:

```text
$kindling-source-ingestion cold-start
```

## Customer policy

Cold start creates:

```text
.kindling/
├── ingestion-policy.yaml
├── .gitignore
├── reports/       # ignored
└── state/         # ignored
```

Validate after editing:

```bash
npx @kindling/agent policy validate
```

The policy is deny-only. It can add confidential topics and entities but cannot
disable static exclusions or approve future writes.

## Operation

Use the source-ingestion skill in `run` mode. It checks the Granola account and
active workspace, finds new or changed material, creates a review report, and
stops. Submit the exact `APPROVE` command printed by the report. The hook then
permits only those exact Kindling tool arguments.

Audit receipts:

```bash
npx @kindling/agent audit
```

Run local diagnostics:

```bash
npx @kindling/agent doctor
```

## Uninstall

Preview:

```bash
npx @kindling/agent uninstall --target all
```

Execute:

```bash
npx @kindling/agent uninstall --target all --execute --yes
```

Uninstall preserves `.kindling/ingestion-policy.yaml`, reports, and ledgers.
Delete them separately only when the customer explicitly requests data removal.
