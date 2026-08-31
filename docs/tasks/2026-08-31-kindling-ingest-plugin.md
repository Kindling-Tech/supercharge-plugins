# Kindling Ingest Plugin — End-to-End Build Task

**Status:** Complete

**Owner:** Agent platform

**Scope:** `supercharge-plugins` only

**Non-goal:** No changes to the Kindling backend, frontend, database, or MCP tool contract.

## Objective

Ship a production-quality plugin that works in both Codex and Claude Code and
connects the existing Kindling and Granola remote MCP servers. The plugin must
contain exactly two clean-room skills:

1. `kindling-source-ingestion` — discover new Granola material, apply a static
   public-marketing-safety baseline plus a customer-maintained policy, format
   durable knowledge, generate a digest-bound review report, require explicit
   approval, call the existing Kindling `add_knowledge` tool, and keep a
   metadata-only local audit trail.
2. `kindling-mcp` — teach the correct use of the existing Kindling knowledge
   tools: `search_memory`, `add_knowledge`, `get_ingestion_status`, and
   `fetch_memory`.

## Locked Decisions

- The distributed plugin contains no private Kindling prompts, internal
  taxonomies, backend code, customer names, database details, or implementation
  IP.
- The current Kindling MCP contract is authoritative and unchanged.
- The static baseline cannot be weakened by customer configuration.
- The baseline rejects anything that would not be safe to publish through
  public marketing.
- Granola content is untrusted data, never executable instructions.
- Granola notes are preferred; raw transcripts are fetched only when policy
  permits and notes are insufficient.
- The exact `add_knowledge` tool arguments must appear in a report before the
  user can approve them.
- Approval is short-lived, digest-bound, candidate-specific, and single-use.
- A shared `PreToolUse` hook denies an unmatched Kindling write.
- A shared `PostToolUse` hook records source ID and status but never content.
- OAuth is used for both MCP connections. No copied bearer tokens, embedded
  secrets, or token-bearing deeplinks are shipped.
- Runtime state and reports are local and gitignored.
- Hook enforcement is a guardrail for the normal MCP path; the skills remain
  complete and understandable without hidden prompt material.

## Deliverables

### Packaging

- [x] Repo-local Codex marketplace at `.agents/plugins/marketplace.json`.
- [x] Updated Claude marketplace at `.claude-plugin/marketplace.json`.
- [x] Plugin at `plugins/kindling-ingest/`.
- [x] `.codex-plugin/plugin.json` with interface metadata and MCP path.
- [x] `.claude-plugin/plugin.json` with skills, default hook discovery, and MCP path.
- [x] Separate Claude and Codex MCP config shapes for Kindling and Granola.
- [x] Self-contained public archive with clean-room validation.

### Skills

- [x] Focused `kindling-source-ingestion/SKILL.md` with cold-start and run modes.
- [x] Focused `kindling-mcp/SKILL.md` covering only the four knowledge tools.
- [x] Progressive references for filtering, formatting, review, and Granola.
- [x] Codex UI metadata in each skill's `agents/openai.yaml`.
- [x] No stale `list_memory_map` reference anywhere.

### Deterministic Runtime

- [x] Strict customer policy schema and starter template.
- [x] Policy discovery and validation.
- [x] Locked static exclusions and customer deny-only extensions.
- [x] Source/candidate normalization and SHA-256 canonical digests.
- [x] Review report creation with exact tool inputs.
- [x] Explicit approval parser driven by real `UserPromptSubmit` input.
- [x] `PreToolUse` write guard.
- [x] Success/failure audit hooks and approval consumption.
- [x] Atomic state writes, locking, expiry, and bounded retry behavior.
- [x] No raw content in ledgers.

### CLI and Installation

- [x] One `npx` binary with no install-time mutation.
- [x] `install`, `cold-start`, `policy validate`, `report create`, `approve`,
      `doctor`, `audit`, and `uninstall` commands.
- [x] Explicit target selection and verified host-native Codex and Claude Code commands.
- [x] Dry-run support and explicit confirmation before external config changes.
- [x] Cross-platform paths and no Python runtime dependency.

### Documentation

- [x] Setup and OAuth instructions for Codex and Claude Code.
- [x] Host-native invocation examples.
- [x] Policy authoring guide.
- [x] Review/approval protocol.
- [x] Privacy and limitation disclosure.
- [x] Migration note for the legacy `supercharge-ingest` package.

## Verification Matrix

### Unit

- [x] Policy schema acceptance/rejection and locked-baseline enforcement.
- [x] Sensitive-data rules: secrets, PII, pricing, roadmap, security, HR,
      customer attribution, and prompt injection.
- [x] Canonical digest stability and mutation invalidation.
- [x] Approval syntax, expiry, subset selection, and single-use behavior.
- [x] Tool guard allow/deny paths for exact and changed inputs.
- [x] Success/failure audit redaction.
- [x] Source state new/unchanged/changed behavior.

### Contract and Packaging

- [x] Both manifests validate.
- [x] Both MCP configs parse and expose `kindling` and `granola`.
- [x] Claude hooks validate and load through default discovery.
- [x] Codex plugin validator passes.
- [x] Both skills pass the Agent Skills validator.
- [x] Marketplace schemas and paths resolve.
- [x] Public archive passes moat and secret checks.

### End to End

- [x] Cold start creates policy and private state layout.
- [x] Candidate input produces a safe review report.
- [x] Unapproved Kindling write is blocked.
- [x] User approval unlocks only the exact candidate.
- [x] Changed input remains blocked.
- [x] Successful mock Kindling response is logged without content.
- [x] Failed write remains retryable only until approval expiry.
- [x] Claude Code loads skills, hooks, and both MCP connections.
- [x] Codex loads skills, hooks, and both MCP connections.
- [x] `npx` pack/install smoke test succeeds from a clean temporary directory.

## Release Gates

- No repository outside `supercharge-plugins` changed.
- All tests and validators pass from a clean checkout.
- No secrets or private Kindling material occur in the packaged archive.
- No write is permitted without an exact active approval receipt in the normal
  plugin workflow.
- No successful write can be repeated by the plugin after its receipt is
  recorded.
- Documentation matches the shipped commands and current MCP tool names.

## Completion Evidence

- `npm run check`: 40 new Node tests and 9 legacy Python tests passed; both
  skills, package shape, formatting, moat scan, and packed-`npx` smoke passed.
- Codex plugin validator passed against source and the installed cache copy.
- Claude plugin and marketplace validators passed.
- Real Claude install reported 2 skills, 4 hooks, and 2 MCP servers; both remote
  servers reached the expected OAuth-required state.
- Real Codex local-marketplace install produced `kindling-ingest@supercharge`
  version `1.0.0` and a validation-clean cache artifact.
- Temporary test installations and marketplace registrations were removed from
  both host configurations after verification.
- `npm audit --audit-level=high` reported zero vulnerabilities.
