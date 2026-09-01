# Distribution and release

## Source layout

The plugin source is `plugins/kindling`. Claude Code discovers it from
`.claude-plugin/marketplace.json`; Codex discovers it from
`.agents/plugins/marketplace.json`. Both entries use the stable plugin name
`kindling` and marketplace name `supercharge`.

This release renames the previous `kindling-ingest` plugin ID. Treat it as a
new installation in both hosts; the marketplace does not publish both IDs in
parallel because that would expose duplicate skills, hooks, and MCP servers.

## Versioning

The version in both plugin manifests and `packages/agent-cli/package.json` must
match. Use semantic versioning. A release that changes hook semantics, policy
schema, approval canonicalization, or state compatibility requires explicit
migration notes and the appropriate version bump.

## Release checklist

1. Update the internal build task and changelog notes.
2. Run `npm ci` from a clean checkout.
3. Run `npm run check`.
4. Run the Codex plugin validator.
5. Run `claude plugin validate ./plugins/kindling`.
6. Inspect `npm pack --dry-run --workspace @kindling/agent`.
7. Inspect a clean `git archive` of the plugin and run the moat check against it.
8. Test local Claude loading with `--plugin-dir`.
9. Test a repo-local Codex marketplace installation in an isolated home/config
   directory.
10. Test both OAuth flows with non-production accounts; never place credentials
    in fixtures or logs.
11. Test an unapproved write, exact approved write, changed write, success
    receipt, and failed retry.
12. Publish the npm package with provenance and publish the marketplace commit.
13. Start new host sessions and repeat the smoke test from the published source.

## Quality over time

- Keep the two skill descriptions narrow; do not accumulate unrelated Kindling
  features.
- Add a regression fixture for every demonstrated filtering or approval miss.
- Prefer changing deterministic policy code over adding repetitive prompt text.
- Treat policy-schema changes as data migrations.
- Monitor only non-content outcomes: report count, withheld-rule counts,
  approvals, write success/failure, and plugin version.
- Never add telemetry that contains prompts, notes, transcripts, candidate
  content, customer terms, or policy entries.
- Re-run official Codex, Claude Code, Granola, and Agent Skills documentation
  checks before each minor or major release.
