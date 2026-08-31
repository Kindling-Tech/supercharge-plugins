# Review and approval protocol

## Report integrity

The bundled script canonicalizes the exact Kindling tool arguments and computes
SHA-256 digests for every candidate and the report. Reports expire according to
the customer policy.

Standard report output shows safe candidates in full and withheld categories by
count. It does not store or show raw withheld excerpts by default.

## Approval

Only the exact command printed by the report authorizes a write:

```text
APPROVE KIR-20260831-101500-ab12 0123456789ab KI-001,KI-003
```

`ALL` is allowed only when the policy enables it. Praise such as “looks good,”
an earlier request to finish, or approval of another report is not approval.

The prompt hook binds the approval to the real user-submitted prompt, report
digest, selected candidates, session, expiry, and exact tool-input digest.

## Write guard

Before a Kindling `add_knowledge` call, the hook recomputes the tool-input digest.
It denies when approval is missing, expired, consumed, from another active
session, rejected, or for different arguments. A valid receipt does not bypass
the host's normal permission prompt.

## Success and failure

- Success records report ID, candidate ID, input digest, source ID, status, and
  time, then consumes the approval.
- Failure records only failure type and hashes. It does not store source text or
  raw error output.
- A failed call may be retried with identical arguments before approval expiry.
- A successful call is never retried.
- Any edit requires a new report and user approval.
