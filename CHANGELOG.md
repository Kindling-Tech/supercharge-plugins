# Changelog

## 1.3.0 - 2026-10-12

- Enabled the read-only `search_sources` and `read_source` tools in the
  production and staging plugins, so an agent can find and read the original
  uploads, meeting notes, and documents behind company knowledge.
- Updated the `kindling-mcp` and `kindling-staging-mcp` skills and the knowledge
  tool contract: use source search for what a source actually said and to check
  for an already-added source before a write, and fall back to `search_memory`
  when the tools are not yet available.

## 1.2.1 - 2026-09-04

- Fixed production and staging ingestion skills to resolve their packaged
  `dist` CLI entrypoints relative to each installed skill.
- Removed the misleading organization-name setup decision. The company selected
  by browser OAuth is the only tenant authority.
- Added regression coverage for non-routing policy labels, bundled CLI paths,
  and synchronized release versions.
