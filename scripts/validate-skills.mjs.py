#!/usr/bin/env python3
"""Validate every shipped skill with the bundled Codex skill validator."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = Path.home() / ".codex/skills/.system/skill-creator/scripts/quick_validate.py"


def main() -> int:
    skills = sorted((ROOT / "plugins/kindling-ingest/skills").glob("*/SKILL.md"))
    if len(skills) != 2:
        print(f"expected exactly 2 skills, found {len(skills)}", file=sys.stderr)
        return 1
    for skill_md in skills:
        subprocess.run(
            [sys.executable, str(VALIDATOR), str(skill_md.parent)],
            check=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
