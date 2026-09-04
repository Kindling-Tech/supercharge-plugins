#!/usr/bin/env python3
"""Validate every shipped skill with the bundled Codex skill validator."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = Path.home() / ".codex/skills/.system/skill-creator/scripts/quick_validate.py"


def main() -> int:
    expected = {
        "kindling": {"kindling-mcp", "kindling-source-ingestion"},
        "kindling-staging": {
            "kindling-staging-mcp",
            "kindling-staging-source-ingestion",
        },
    }
    skills: list[Path] = []
    for plugin, expected_names in expected.items():
        discovered = sorted((ROOT / f"plugins/{plugin}/skills").glob("*/SKILL.md"))
        discovered_names = {skill.parent.name for skill in discovered}
        if discovered_names != expected_names:
            print(
                f"{plugin} skills mismatch: expected {sorted(expected_names)}, "
                f"found {sorted(discovered_names)}",
                file=sys.stderr,
            )
            return 1
        skills.extend(discovered)
    if len(skills) != 4:
        print(f"expected exactly 4 skills, found {len(skills)}", file=sys.stderr)
        return 1
    for skill_md in skills:
        subprocess.run(
            [sys.executable, str(VALIDATOR), str(skill_md.parent)],
            check=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
