# Kindling Staging Plugin

**Status:** Implemented

**Owner:** Agent platform

**Scope:** `supercharge-plugins` only

## Objective

Ship an internal `kindling-staging` plugin for Codex and Claude Code that
connects `https://api.staging.kindling.team/mcp` and can be installed alongside
the production `kindling` plugin without namespace, OAuth, approval, or audit
state collisions.

## Locked decisions

- Production remains the default CLI environment and remains backward
  compatible.
- Staging uses plugin and MCP server ID `kindling-staging`.
- Staging skills are explicit-only and have staging-specific names.
- Both plugins share one runtime source but plugin bundles are locked to their
  build environment.
- The customer policy remains shared at `.kindling/ingestion-policy.yaml`.
- Staging reports and ledgers live under `.kindling/reports/staging/` and
  `.kindling/state/staging/`.
- Report IDs, report digests, candidate digests, approvals, receipts, and
  failures are bound to the target environment and MCP resource.

## Deliverables

- [x] Codex and Claude staging manifests.
- [x] Staging MCP configuration and OAuth resource.
- [x] Marketplace entries for both hosts.
- [x] Staging-specific skills and hooks.
- [x] Shared runtime environment profiles and locked plugin builds.
- [x] Environment-aware CLI install, connect, doctor, and uninstall commands.
- [x] Production hook exclusions for staging tool names.
- [x] Package, skill, build, and coexistence validations.
- [x] Installation and distribution documentation.

## Acceptance criteria

- `kindling@supercharge` connects only production.
- `kindling-staging@supercharge` connects only staging.
- Both plugins can be installed and authenticated at the same time.
- Generic Kindling requests continue to invoke production only.
- A production approval cannot authorize a staging write and vice versa.
- The full repository quality workflow passes before release.
