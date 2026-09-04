---
name: kindling-staging-mcp
description: Use the internal Kindling Staging knowledge MCP for semantic recall, known-path fetches, reviewed knowledge writes, and ingestion-status checks. Use only when explicitly testing staging. Route staging ingestion of external sources, URLs, notes, and transcripts to kindling-staging-source-ingestion. Do not use for production Kindling or unrelated platform features.
---

# Kindling Staging knowledge MCP

This skill targets the non-production staging environment. Never present its
results as production data and never substitute it for the production
`kindling-mcp` skill.

Use only the public knowledge contract documented in
[knowledge-tool-contract.md](references/knowledge-tool-contract.md):
`search_memory`, `fetch_memory`, `add_knowledge`, and
`get_ingestion_status`.

## Recall

1. Use `search_memory` for a narrow semantic question.
2. Preserve source evidence and cautions returned by the tool.
3. Say that no authoritative memory was found when the answer says so.
4. Use `fetch_memory` only when a specific canonical document path is already
   known. Never invent paths.

## Write

1. Route URLs, transcripts, meeting notes, files, connected knowledge sources,
   and other external material to the `kindling-staging-source-ingestion` skill.
2. For a durable fact supplied directly by the user, create a one-candidate
   reviewed report using `connector_label: manual-reviewed`.
3. Wait for the exact report approval command.
4. After approval, call `search_memory` on the safe topic.
5. Skip a duplicate. For a correction, state what changed; any edited payload
   needs a new report and approval.
6. Call `add_knowledge` once with the exact reviewed arguments.
7. Capture the returned `source_id` and status. Never resubmit a successful
   write, even if search has not caught up yet.

## Status

Use `get_ingestion_status(source_id)` only with a source ID returned by a prior
write. Do not poll tightly. Explain terminal statuses without automatically
rewriting or resending content.

## Errors

- Authentication: ask the user to reconnect Kindling Staging through OAuth.
- Authorization: report the missing scope; do not seek another credential.
- Rate limit: stop and retry later, once.
- Unknown tool: run connection diagnostics; do not guess a replacement.
- Failed or quarantined content: show the reason and wait for direction.

Do not describe internal Kindling implementation, private prompts, schemas, or
features outside this public knowledge contract.
