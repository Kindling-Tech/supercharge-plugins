# Kindling analytics tool contract

The server's tool schemas and descriptions are the authority for exact argument
names, allowed values and defaults. This page says what each tool is for and
the rules that matter when answering. Every tool reads or changes only the
connected company's data.

Common arguments:

- `window`: the period the numbers cover. State it in every answer.
- `scope`: `company`, `founder` (one Profile, with `founder_id`) or `all`.
  Connection fields need `scope=founder`.
- `founder_id`: an exact ID from `list_profiles`.
- Paging: follow `next_cursor`, `has_more` or the next offset to the end before
  claiming a total or "all", or quote the returned `total`.

## Analytics reads

### `get_analytics_overview(window?, scope?, founder_id?, metric?)`

The Analytics page's top: hero numbers, the platform breakdown, What's working
and Your activity. Use it for "how are we doing" and "what's working". A metric
it marks unavailable is unknown, not 0.

### `list_posts(window?, sort?, platform?, scope?, founder_id?, ...)`

Published posts with their metrics. Sort by engagement for "top" or "best".
Posts count by publish date.

### `get_post(post_id)`

One post card with its 48-hour and 7-day insights.

### `list_analytics_people(segment?, query?, post_id?, window?, scope?, founder_id?, persona_id?, target_status?, connection?, sort?, moved_since?, ...)`

The People and Targets table. Filters:

- `segment`: which group (for example targets or lighthouses).
- `query`: a name search. `post_id`: people who engaged with one post.
- `target_status`: the saved stage, one or more of `unaware`, `aware`,
  `engaging`, `engaged`, `co_signed`.
- `connection`: `direct`, `not_listed` or `unknown`; only with `scope=founder`.
- `moved_since`: only people who reached their stage since that date.

Each row carries `target_status`, and with `scope=founder` also `connection`
and `connection_degree`. The response carries counts; page to the end before
listing "all".

### `get_relationship_grid(scope?, founder_id?, relationship_range?, persona_id?)`

The stage by connection grid: each cell is a stage (Unaware to Co-signed) by a
connection column (1st degree, other LinkedIn members, unknown), with a few
people and the people who moved into it during the range. "Moved" counts
arrivals at a stage in the range, not net change.

### `list_comment_activity(...)`

Comments on the company's posts and comments its founders left elsewhere, for
a window.

### `list_profile_scopes()`

Which Profiles have analytics, for choosing `scope` and `founder_id`.

### `get_person_spotlight(...)`

The people who stand out for the period, as on the Analytics page.

### `get_engager_intel(profile_url)`

The stored dossier for one person: who they are, what they post about, and how
they relate to the company. It reads what is already stored and costs nothing.

## Paid refresh

### `refresh_engager_intel(..., confirm)`

Rebuilds one person's dossier from fresh public data. It costs credits. Tell
the person, wait for their yes to this specific refresh, then call it with
`confirm=true`. Never refresh in a loop or for a list of people unasked.

## Audience

### `fetch_company_people(...)`

The canonical people records. With a Profile it adds that founder's connection,
warmth and an insights dossier.

### `list_personas()`

The company's personas (ICP definitions), with IDs for `persona_id` filters.

### `assign_persona(...)` (write)

Assigns a person to a persona. Only when the person asks.

### `apply_people(...)` (write)

Adds people to the audience, updates them, or marks them as noise. Only when
asked; say who changes and how before the call.

### `restore_person_from_noise(...)`, `set_person_customer(...)` (write, optional)

May not exist on every server. If absent, say that the change has to be made
on the Audience page.

## Next best actions

### `list_action_rules()`

Every next best action type: its trigger, its channel (a DM, a public comment
or post, and so on) and who it targets. Read it before saying which kind of
action fits a person.

### `list_my_actions(...)`, `get_action(...)`

The person's open next best actions, and one action in full.

### `draft_message(...)`

Drafts the message for an action. Kindling never sends it; give the draft to
the person to send themselves.

### `mark_done(...)`, `dismiss(...)`, `undo(...)` (write)

Change an action's state. Only when the person asks for that action.

## Retired tools

`list_post_analytics`, `list_engager_analytics`, `list_audience`,
`get_audience_person`, `get_audience_insights` and `apply_audience_people` were
removed from the server. Never call them in place of the tools above.
