# Changelog

## 1.2.1 - 2026-09-04

- Fixed production and staging ingestion skills to resolve their packaged
  `dist` CLI entrypoints relative to each installed skill.
- Removed the misleading organization-name setup decision. The company selected
  by browser OAuth is the only tenant authority.
- Added regression coverage for non-routing policy labels, bundled CLI paths,
  and synchronized release versions.
