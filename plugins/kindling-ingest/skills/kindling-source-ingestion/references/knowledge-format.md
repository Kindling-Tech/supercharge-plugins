# Kindling knowledge format

Create one self-contained item per durable topic. The content must remain useful
without access to the source meeting.

## Preferred shape

```markdown
# Enterprise onboarding expectations

Enterprise buyers commonly ask for a concrete implementation timeline before
evaluating advanced workflow features.

This is a generalized buying-process pattern, not an attributed requirement
from one identified customer.
```

## Rules

- Lead with the durable claim.
- Use direct declarative language.
- Separate a stable pattern from a one-off observation.
- Remove speaker names, customer names, meeting titles, and transcript wording.
- Do not say “the customer said” after removing customer identity.
- Do not retain exact dates or numbers unless they are essential, public, and
  approved.
- Do not add conclusions that the source does not establish.
- Keep `title` specific but non-sensitive.
- Set `connector_label` to `granola-reviewed` for Granola or
  `manual-reviewed` for user-provided material.
- Set `origin_uri` to null. Private source URLs are not sent.

The report must show these exact four tool fields: `content`, `title`,
`connector_label`, and `origin_uri`.
