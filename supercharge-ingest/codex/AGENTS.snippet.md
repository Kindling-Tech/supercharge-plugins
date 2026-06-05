## Saving knowledge (Supercharge)

When the user says "remember this", "save this to our knowledge base", "add this to memory", "ingest", "keep this for later", or shares a durable fact about their company / product / customers / strategy, use the `supercharge` MCP server to save it:

- Call `add_knowledge` with the durable content as `content`. For a URL, fetch its readable content first and pass that as `content`, setting `origin_uri` to the URL.
- Only `content` is required; the save is reviewed/compiled asynchronously and returns a receipt with a `status`.
- Recall with `list_memory_map` then `fetch_memory`; check a prior save with `get_ingestion_status`.

Do NOT save secrets, credentials, local source code, or transient chatter. After saving, report what was saved and the returned status.
