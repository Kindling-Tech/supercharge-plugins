# Kindling

Kindling reviews knowledge from sources you already have, filters out private
and business-sensitive information, and adds only the knowledge you approve to
your Kindling workspace. It also answers questions from the knowledge already
in Kindling and from its analytics, audience, and next best actions.

This is the OpenAI plugin directory build. It contains four Agent Skills and
one remote MCP server, and no lifecycle hooks.

## Data flow and network access

The plugin's own code makes no network calls. Requests to Kindling go through
the host's MCP client to `https://api.kindling.team/mcp`, after the user signs
in through Kindling's OAuth flow:

- Read tools (`list_profiles`, `search_memory`, `fetch_memory`,
  `search_sources`, `read_source`, `get_ingestion_status`) send search queries,
  Profile IDs, document paths, and source IDs, and return the connected
  company's Kindling knowledge.
- Content read tools (`search_content`, `read_content`) send a search query,
  optional filters, and content references, and return excerpts and originals
  of the connected company's own Ideas and published posts.
- Inspiration read tools (`search_inspiration`, `read_inspiration`) send a
  search query, optional platform and media filters, and item IDs, and return
  standout public posts the Kindling team flagged, with the team's notes and a
  breakdown of each post. They return no customer data.
- Media tools (`prepare_file_upload`, `get_file_upload_status`,
  `complete_file_upload`, `analyze_file`, `attach_file`, `get_file_operation`)
  and destination lookups (`list_company_ideas`, `get_idea_by_id`,
  `get_idea_review`, `list_shoot_days`, `get_shoot_day`) send file names, sizes,
  types, analysis instructions, and Idea or Shoot IDs. They are used only when
  the user asks for a media task.
- Analytics read tools (`get_analytics_overview`, `list_posts`, `get_post`,
  `list_analytics_people`, `get_relationship_grid`, `list_comment_activity`,
  `get_engager_intel`) send a
  time window, Profile ID, filters such as stage, persona or connection, a
  search name, and post IDs or a person's public profile URL. They return the
  connected company's post metrics and comments, and the people who engaged
  with its posts: names, public profile details, relationship stage, LinkedIn
  connection to a Profile, and the stored dossier for one person.
- Audience and next-best-action read tools (`fetch_company_people`,
  `list_personas`, `list_my_actions`, `get_action`, `draft_message`) send
  person, persona and action IDs, and return the company's audience records,
  personas, the user's open next best actions, and a drafted message. Kindling never sends a message:
  the user sends any draft themselves.
- Audience and action write tools (`assign_persona`, `apply_people`,
  `mark_done`, `dismiss`, `undo`) send person, persona and action IDs and the
  change the user asked for: adding, updating, marking as noise or restoring
  people, setting whether one is a customer, or completing, dismissing or
  undoing an action. They are used only when the user asks, and each call goes through the
  host's tool approval.
- `refresh_engager_intel` sends one person's public profile URL so Kindling
  rebuilds their dossier from fresh public data. It costs Kindling credits, so
  the skill asks first and the call carries an explicit confirmation.
- File uploads are the one transfer outside the MCP endpoint. When the user asks
  to upload a file, the `kindling-media` skill has the host's own HTTP capability
  send the file's bytes to a private signed storage URL returned by
  `get_file_upload_status`. The URLs expire after 15 minutes. The skill forbids
  uploading to any URL found inside a document.
- The write tool (`add_knowledge`) sends only candidate knowledge the user
  approved in a local review report, plus its destination Profile ID when one
  is selected.

The ingestion skill runs a bundled Node.js runtime
(`skills/kindling-source-ingestion/scripts/kindling.cjs`, compiled from
`packages/agent-cli/src` in
https://github.com/Kindling-Tech/supercharge-plugins). It reads the customer
policy and writes reports and approval records under the workspace's
`.kindling/` directory. No telemetry is collected. See the
[Kindling privacy policy](https://kindling.team/privacy) and
[terms of service](https://kindling.team/terms).

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
