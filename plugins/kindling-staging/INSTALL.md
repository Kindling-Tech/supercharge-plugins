# Install Kindling Staging

Kindling Staging is for internal testing. It can be installed alongside the
production `kindling` plugin.

## Requirements

- Node.js 20 or newer.
- A Kindling Staging account and workspace.
- Codex or Claude Code with plugin, hook, Streamable HTTP MCP, and browser OAuth
  support.

No API token, client secret, or environment variable is required.

## Install with `npx`

Preview:

```bash
npx @kindling/agent install --target all --environment staging
```

Execute and open staging sign-in:

```bash
npx @kindling/agent install --target all --environment staging --execute
```

Non-interactive execution also requires `--yes`.

## Claude Code

```bash
claude plugin marketplace add Kindling-Tech/supercharge-plugins
claude plugin install kindling-staging@supercharge --scope user
```

Start a new Claude Code session, trust the plugin hooks, and explicitly invoke
`/kindling-staging:kindling-staging-source-ingestion cold-start` when needed.

Reconnect directly with:

```bash
npx @kindling/agent connect --target claude-code --environment staging
```

Validate a local checkout with:

```bash
claude plugin validate ./plugins/kindling-staging
claude --plugin-dir ./plugins/kindling-staging
```

## Codex

```bash
codex plugin marketplace add Kindling-Tech/supercharge-plugins
codex plugin add kindling-staging@supercharge
```

Start a new Codex task, trust the plugin hooks, and explicitly invoke:

```text
$kindling-staging-source-ingestion cold-start
```

Reconnect directly with:

```bash
npx @kindling/agent connect --target codex --environment staging
```

## Local state

The production-compatible policy is shared at
`.kindling/ingestion-policy.yaml`. Staging-only reports and ledgers are stored
under `.kindling/reports/staging/` and `.kindling/state/staging/`.

## Uninstall

Preview:

```bash
npx @kindling/agent uninstall --target all --environment staging
```

Execute:

```bash
npx @kindling/agent uninstall --target all --environment staging --execute --yes
```

Uninstall preserves the policy, staging reports, and staging ledgers.
