# Kindling

Kindling is a dual-host plugin for Codex and Claude Code. It connects one
existing OAuth MCP server:

- Kindling workspace: `https://api.kindling.team/mcp`

The plugin does not run or proxy the service. Knowledge sources are optional:
the ingestion skill may use notes, files, URLs, or connectors the user already
authorized in the host, but none are bundled with or required by this plugin.

## Install

In Claude Code 2.1.275 or later:

```text
/plugin install kindling --marketplace Kindling-Tech/supercharge-plugins
```

## Data flow and network access

The plugin's own code makes no network calls. Requests to Kindling go through
the host's MCP client to `https://api.kindling.team/mcp`, after the user signs
in through Kindling's browser OAuth flow:

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
  person, persona and action IDs and an optional Profile ID, and return the
  company's audience records, personas, the open next best actions for every
  Profile or one, and a drafted message. Kindling never sends a message: the
  user sends any draft themselves.
- Audience and action write tools (`assign_persona`, `apply_people`,
  `mark_done`, `dismiss`, `undo`) send person, persona and action IDs and the
  change the user asked for: adding, updating, marking as noise or restoring
  people, setting whether one is a customer, or completing, dismissing or
  undoing an action. They are used only when the user asks, and Codex prompts before each
  call.
- `refresh_engager_intel` sends one person's public profile URL so Kindling
  rebuilds their dossier from fresh public data. It costs Kindling credits, so
  the skill asks first and the call carries an explicit confirmation; Codex
  also prompts before it.
- File uploads are the one transfer outside the MCP endpoint. When the user asks
  to upload a file, the `kindling-media` skill has the host's own HTTP capability
  send the file's bytes to a private signed storage URL returned by
  `get_file_upload_status`. The URLs expire after 15 minutes. The skill forbids
  uploading to any URL found inside a document.
- The write tool (`add_knowledge`) sends only candidate knowledge the user
  approved in a local review report, plus its destination Profile ID when one
  is selected.

Locally, the hooks and skills run the bundled Node.js runtime
(`dist/kindling-guard.cjs`, compiled from `packages/agent-cli/src` in this
repository). It reads the customer policy and writes reports and
metadata-only ledgers under the workspace's `.kindling/` directory. At Claude
Code startup the `SessionStart` hook runs `claude mcp list` to check the
Kindling connection and, only when signed out, starts Claude Code's own MCP
sign-in, which opens the Kindling sign-in page in the browser. Turn this off
with the plugin's `auto_connect` setting. No telemetry is collected. See the [Kindling privacy policy](https://kindling.team/privacy) and
[terms of service](https://kindling.team/terms).

## Components

- Four Agent Skills: safe source ingestion, Kindling knowledge MCP usage,
  media upload, analysis, and attachment, and analytics, audience, and next
  best actions.
- A customer-maintained `.kindling/ingestion-policy.yaml`.
- A deterministic local review/report runtime.
- A Claude `SessionStart` connection hook plus shared `UserPromptSubmit`,
  `PreToolUse`, `PostToolUse`, and `PostToolUseFailure` hooks.
- Metadata-only local source, approval, sent, and failure ledgers.
- A compiled Node 20+ runtime; Python is not required.

## Safety model

The skill filters for durable information whose exact final wording is safe for
public marketing. The report contains exact `add_knowledge` arguments. The user
approves a report digest and selected candidates. The write hook recomputes the
arguments' digest and denies mismatches before the MCP call.

The hook does not auto-approve valid calls. The host's ordinary tool permission
policy still applies.

## Privacy

- Raw source notes, documents, and transcripts are not stored by the plugin.
- Reports persist only candidate content that passed deterministic filtering.
- Withheld content is represented by rule identifiers and counts.
- Ledgers store hashes, IDs, status, and timestamps, not content.
- Private source record IDs are HMACed with a local random key.
- Credentials are managed by the Kindling MCP's browser OAuth flow.

The selected Codex or Claude model necessarily receives the source content it
is asked to review. The filtering boundary is before Kindling ingestion, not
before the host model processes the source.

## Limitation

The plugin controls writes made through its own normal MCP workflow. It cannot
disable or govern a separate background integration a customer may have enabled
outside this plugin.

See [`INSTALL.md`](INSTALL.md) for setup and [`DISTRIBUTION.md`](DISTRIBUTION.md)
for release operations.
