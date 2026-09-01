# Kindling knowledge tool contract

## `search_memory(query)`

Semantic company-knowledge search. Ask one narrow question. The answer may
include source IDs, evidence, and cautions. Also use this after approval and
before a write to avoid duplicates.

## `fetch_memory(document_path)`

Fetch one live knowledge document by a path already obtained from authoritative
context. Never guess a document path.

## `add_knowledge(content, title?, connector_label?, origin_uri?)`

Save one self-contained durable knowledge item. The plugin requires a matching
active approval receipt before the normal MCP call can execute.

The response is a receipt, not the final compilation verdict. Capture
`source_id` and `status`. A returned source ID means the content was saved;
never submit it again. Recent writes can take time to appear in search.

## `get_ingestion_status(source_id)`

Read the current status of a prior source:

- `accepted_for_compilation`: saved and still processing; do not resubmit.
- `accepted`: compiled successfully.
- `not_actionable`: no durable knowledge was produced.
- `quarantined`: wait for review; do not rewrite automatically.
- `rejected`: show the reason and wait for corrected user input.
- `failed`: report failure and stop unless the user explicitly requests one
  safe retry.
