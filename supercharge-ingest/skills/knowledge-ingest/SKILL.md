---
name: knowledge-ingest
description: Save durable knowledge to the Supercharge knowledge base. Use when the user says "remember this", "save this to our knowledge base", "add this to memory", "ingest", "keep this for later", or shares a durable fact about their company, product, customers, positioning, strategy, or decisions.
---

# Knowledge Ingest

Save durable company knowledge to the user's Supercharge knowledge base using the `supercharge` MCP server. Prefer saving over assuming something is already known — duplicates and irrelevant content are handled automatically on the server.

## Tools (from the `supercharge` MCP server)

- `add_knowledge(content, title?, origin_uri?)` — save a durable fact. Only `content` is required. Returns a receipt `{source_id, status, ...}` immediately; the knowledge is reviewed and compiled asynchronously.
- `get_ingestion_status(source_id)` — check what happened to an earlier save.
- `list_memory_map()` — see what knowledge already exists (the routing index).
- `fetch_memory(document_path)` — read one knowledge document (path from `list_memory_map`).

## When to save (use `add_knowledge`)

Save when the user shares something worth remembering: company facts, product details, customer/ICP info, positioning, strategy, decisions, brand/voice notes, or process knowledge.

- **Plain fact / pasted text:** pass it directly as `content`.
- **A URL:** fetch the readable content first (use your own web tools), pass that as `content`, and set `origin_uri` to the URL. If you can't fetch it, summarize what the user said and still set `origin_uri`.
- Add a short `title` when it helps.

After saving, briefly tell the user what was saved and the returned `status`.

## When to read

Before answering questions about the company, call `list_memory_map` to see what's known, then `fetch_memory` on the relevant document.

## Do NOT save

- Secrets, credentials, API keys, tokens.
- Local source code or file contents the user is just working on.
- Transient chit-chat or one-off instructions not meant to persist.
- Anything the user did not intend to remember.

## Trigger phrases

"remember this", "save this to our knowledge base", "add this to memory", "ingest this", "keep this for later", "note this down", "store this".
