#!/usr/bin/env python3
"""Auto-ingest intent detector for the supercharge-ingest plugin.

Reads a UserPromptSubmit hook payload on stdin. If the user clearly wants
something saved to their Supercharge knowledge base, prints a JSON directive
(hookSpecificOutput.additionalContext) telling the agent to call the
`add_knowledge` MCP tool now. Otherwise prints nothing.

Pure standard library. Never writes anything itself — the actual write goes
through the authenticated `add_knowledge` MCP tool, so server-side review /
quarantine still applies. Always exits 0 (advisory only).
"""
from __future__ import annotations

import json
import re
import sys

# Explicit "save this" cues — deliberately narrow so we fire on clear intent,
# not on every mention of a URL.
_INTENT = re.compile(
    r"\b("
    r"remember (?:this|that)"
    r"|save (?:this|it|that)?\s*(?:to|in|into)?\s*(?:our|my|the)?\s*(?:knowledge ?base|memory|kb)"
    r"|add (?:this|it|that)?\s*(?:to|into)\s*(?:our|my|the)?\s*(?:knowledge ?base|memory|kb)"
    r"|ingest (?:this|it|that)?"
    r"|keep (?:this|that) for later"
    r"|note this(?: down)?"
    r"|store this"
    r")\b",
    re.IGNORECASE,
)

_URL = re.compile(r"https?://[^\s)\]}>\"']+", re.IGNORECASE)

_PROMPT_KEYS = ("prompt", "user_prompt", "userPrompt")


def extract_prompt(payload: dict) -> str:
    for key in _PROMPT_KEYS:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def build_directive(prompt: str) -> str | None:
    """Return the directive string if the prompt shows clear ingestion intent."""
    if not prompt or not _INTENT.search(prompt):
        return None
    url_match = _URL.search(prompt)
    if url_match:
        url = url_match.group(0)
        detail = (
            f"- A URL was provided: {url}\n"
            "  If you can fetch its readable content, pass that as `content`; "
            "otherwise summarize what the user said about it.\n"
        )
        origin = f" and set `origin_uri` to {url}"
    else:
        detail = "- Use the fact/text the user wants remembered as `content`.\n"
        origin = ""
    return (
        "Ingestion intent detected. The user wants this saved to the Supercharge "
        "company knowledge base. Call the `add_knowledge` tool from the "
        "`supercharge` MCP server NOW, without asking for confirmation:\n"
        f"{detail}"
        f"Pass the durable, readable content as `content`{origin}. After it "
        "returns, briefly tell the user what was saved and the `status` from the "
        "receipt. Do NOT save secrets, credentials, tokens, or local source code."
    )


def main() -> int:
    raw = sys.stdin.read() or "{}"
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return 0
    if not isinstance(payload, dict):
        return 0
    directive = build_directive(extract_prompt(payload))
    if not directive:
        return 0
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": directive,
        }
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
