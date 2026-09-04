# Install Kindling

## Requirements

- Node.js 20 or newer for the local guard runtime.
- A Kindling account with access to the intended workspace.
- Codex or Claude Code with plugin, hook, Streamable HTTP MCP, and browser OAuth
  support.

No API token, OAuth client secret, or environment variable is required.

This document installs production. The internal staging plugin uses the
separate selector `kindling-staging@supercharge` and may be installed alongside
production without sharing approvals or audit state.

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

Execute after reviewing the commands. This also opens secure Kindling sign-in
for each selected host:

```bash
npx @kindling/agent install --target all --execute
```

Non-interactive execution also requires `--yes`. Use `--no-connect` only when
an administrator intentionally wants to defer sign-in.

## Claude Code

```bash
claude plugin marketplace add Kindling-Tech/supercharge-plugins
claude plugin install kindling@supercharge --scope user
```

During installation Claude Code asks whether it should connect Kindling. Leave
that enabled for the simplest setup. On the next session the plugin opens the
secure Kindling browser sign-in automatically. Then:

1. Run `/plugins` and confirm `kindling@supercharge` is enabled.
2. Run `/hooks`, inspect the four plugin hooks, and trust them.
3. Confirm Kindling shows as connected in `/mcp` only if troubleshooting.
4. Run `/kindling:kindling-source-ingestion cold-start`.

To reopen sign-in without navigating an MCP menu:

```bash
npx @kindling/agent connect --target claude-code
```

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

The marketplace sets authentication to `ON_INSTALL`, so Codex asks the user to
connect Kindling during installation. Start a new Codex task so it loads the
installed plugin, review and trust the plugin hooks, then invoke:

```text
$kindling-source-ingestion cold-start
```

To reopen sign-in directly:

```bash
npx @kindling/agent connect --target codex
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

Use the source-ingestion skill in `run` mode. When the user is working with
notes, meetings, documents, URLs, or another connected knowledge source, the
agent first asks whether they want a sensitivity-reviewed transfer to Kindling
(Supercharge). If they agree, it reads only the approved scope, finds new or
changed material, creates a review report, and stops. Submit the exact
`APPROVE` command printed by the report. The hook then permits only those exact
Kindling tool arguments.

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
