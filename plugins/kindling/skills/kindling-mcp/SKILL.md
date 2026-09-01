---
name: kindling-mcp
description: Use the existing Kindling knowledge MCP correctly for semantic recall, known-path fetches, reviewed knowledge writes, and ingestion-status checks. Use for questions about Kindling knowledge or requests to remember a user-provided durable fact. Route external sources, URLs, notes, and transcripts to kindling-source-ingestion. Do not use for unrelated Kindling platform features.
---

# Kindling knowledge MCP

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

1. Route Granola, URLs, transcripts, meeting notes, files, and other external
   sources to the `kindling-source-ingestion` skill.
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

- Authentication: ask the user to reconnect Kindling through OAuth.
- Authorization: report the missing scope; do not seek another credential.
- Rate limit: stop and retry later, once.
- Unknown tool: run connection diagnostics; do not guess a replacement.
- Failed or quarantined content: show the reason and wait for direction.

Do not describe internal Kindling implementation, private prompts, schemas, or
features outside this public knowledge contract.
