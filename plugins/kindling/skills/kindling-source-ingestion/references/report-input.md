# Report input contract

Write this JSON only under gitignored `.kindling/state/`, then pass its path to
`report create --input`.

```json
{
  "source": {
    "provider": "granola",
    "items": [
      {
        "external_id": "provider meeting id",
        "content_digest": "64 lowercase SHA-256 characters",
        "observed_at": "2026-08-31T09:00:00Z"
      }
    ]
  },
  "candidates": [
    {
      "id": "KI-001",
      "title": "Enterprise onboarding expectations",
      "content": "Exact safe content proposed for Kindling.",
      "reason": "Durable generalized buying-process signal.",
      "removed": ["participant_names", "customer_name"]
    }
  ],
  "withheld": [{ "code": "meeting_logistics", "count": 3 }]
}
```

`removed` and `withheld.code` contain rule identifiers only, not snippets.
Candidate IDs use `KI-000`. A private `origin_uri` is rejected. Candidates that
still contain deterministic sensitive markers are automatically withheld and
are not persisted in the report.
