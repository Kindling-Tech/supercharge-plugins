# Kindling

Kindling reviews knowledge from sources you already have, filters out private
and business-sensitive information, and adds only the knowledge you approve to
your Kindling workspace. It also answers questions from the knowledge already
in Kindling.

This is the OpenAI plugin directory build. It contains two Agent Skills and
one remote MCP server, and no lifecycle hooks.

## Data flow and network access

The plugin makes no network calls of its own. Every request to Kindling goes
through the host's MCP client to `https://api.kindling.team/mcp`, after the
user signs in through Kindling's OAuth flow:

- Read tools (`list_profiles`, `search_memory`, `fetch_memory`,
  `search_sources`, `read_source`, `get_ingestion_status`) send search queries,
  Profile IDs, document paths, and source IDs, and return the connected
  company's Kindling knowledge.
- The write tool (`add_knowledge`) sends only candidate knowledge the user
  approved in a local review report, plus its destination Profile ID when one
  is selected.

The ingestion skill runs a bundled Node.js runtime
(`skills/kindling-source-ingestion/scripts/kindling.cjs`, compiled from
`packages/agent-cli/src` in
https://github.com/Kindling-Tech/supercharge-plugins). It reads the customer
policy and writes reports and approval records under the workspace's
`.kindling/` directory. No telemetry is collected. See the
[Kindling privacy policy](https://kindling.team/privacy).

## Safety model

The skill keeps only durable information whose exact final wording is safe for
public marketing. A deterministic scanner withholds candidates that contain a
built-in or customer-defined sensitive marker. The review report shows the
exact `add_knowledge` arguments and a digest-bound approval command.

Nothing is written until the user sends that exact `APPROVE` command. The skill
records the approval with the bundled runtime, which rejects expired,
mismatched, or unknown approvals, and then makes one `add_knowledge` call per
approved candidate with the reviewed arguments unchanged. Each write still goes
through the host's normal tool approval.

This build has no hooks, so the approval check is carried out by the skill and
the host's tool approval rather than enforced by a hook before the call.

## Privacy

- Raw source notes, documents, and transcripts are not stored by the plugin.
- Reports persist only candidate content that passed deterministic filtering.
- Withheld content is represented by rule identifiers and counts.
- Credentials are managed by the Kindling MCP's OAuth flow.

The selected model necessarily receives the source content it is asked to
review. The filtering boundary is before Kindling ingestion, not before the
host model processes the source.

## Support

Report issues at https://github.com/Kindling-Tech/supercharge-plugins/issues.
