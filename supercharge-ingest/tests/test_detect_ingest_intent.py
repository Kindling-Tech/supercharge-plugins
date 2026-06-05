import json
import os
import subprocess
import sys

HOOKS_DIR = os.path.join(os.path.dirname(__file__), "..", "hooks")
sys.path.insert(0, HOOKS_DIR)

import detect_ingest_intent as d  # noqa: E402


def test_fires_on_remember_this():
    out = d.build_directive("Remember this: our pricing is $99/mo for the Pro plan.")
    assert out is not None
    assert "add_knowledge" in out


def test_fires_on_save_to_knowledge_base_with_url():
    out = d.build_directive("Save this to our knowledge base: https://example.com/post")
    assert out is not None
    assert "https://example.com/post" in out
    assert "origin_uri" in out


def test_no_fire_on_plain_question():
    assert d.build_directive("What's the weather today?") is None


def test_no_fire_on_bare_url_without_intent():
    # A URL alone is NOT intent — avoids false positives.
    assert d.build_directive("Can you check https://example.com for me?") is None


def test_directive_mentions_anti_triggers():
    out = d.build_directive("remember this token: keep it safe")
    assert out is not None
    assert "secret" in out.lower() or "credential" in out.lower()


def test_main_emits_additional_context_json():
    payload = json.dumps({"prompt": "remember this: we launched in 2021"})
    proc = subprocess.run(
        [sys.executable, os.path.join(HOOKS_DIR, "detect_ingest_intent.py")],
        input=payload, capture_output=True, text=True,
    )
    assert proc.returncode == 0
    parsed = json.loads(proc.stdout)
    assert parsed["hookSpecificOutput"]["hookEventName"] == "UserPromptSubmit"
    assert "add_knowledge" in parsed["hookSpecificOutput"]["additionalContext"]


def test_main_emits_nothing_on_no_match():
    payload = json.dumps({"prompt": "what files are in this repo?"})
    proc = subprocess.run(
        [sys.executable, os.path.join(HOOKS_DIR, "detect_ingest_intent.py")],
        input=payload, capture_output=True, text=True,
    )
    assert proc.returncode == 0
    assert proc.stdout.strip() == ""
