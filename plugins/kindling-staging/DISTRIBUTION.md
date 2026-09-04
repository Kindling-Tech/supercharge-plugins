# Kindling Staging distribution

The internal plugin source is `plugins/kindling-staging`. Claude Code discovers
it from `.claude-plugin/marketplace.json`; Codex discovers it from
`.agents/plugins/marketplace.json`. Its marketplace selector is
`kindling-staging@supercharge`.

The staging plugin and production plugin share one runtime source but are built
with different immutable environment profiles. Its manifests and MCP files must
contain `https://api.staging.kindling.team/mcp`, staging-specific server names,
and staging-specific skill names. The built plugin runtime must reject attempts
to switch it to production.

## Release checks

1. Run `npm ci` from a clean checkout.
2. Run `npm run check`.
3. Run the Codex plugin validator against `plugins/kindling-staging`.
4. Run `claude plugin validate ./plugins/kindling-staging`.
5. Inspect the staging manifests and MCP files for the exact staging URL.
6. Install production and staging together in isolated host configuration.
7. Confirm each OAuth flow uses its matching API and app origins.
8. Confirm production approvals cannot authorize staging writes and staging
   approvals cannot authorize production writes.
9. Test recall, an unapproved write, an approved write, a changed write, and a
   success receipt with a non-production account.

Never publish staging as installed by default. Staging skills remain explicit
only so ordinary Kindling requests continue to select production.
