import base64
import json
import os
import sys

SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "scripts")
sys.path.insert(0, SCRIPTS_DIR)

import cursor_deeplink as c  # noqa: E402


def test_build_config_shape():
    cfg = c.build_config("https://api.supercharge.so/mcp", "mcp_live_x")
    assert cfg == {
        "url": "https://api.supercharge.so/mcp",
        "headers": {"Authorization": "Bearer mcp_live_x"},
    }


def test_deeplink_roundtrip():
    link = c.build_deeplink("supercharge", "https://api.supercharge.so/mcp", "mcp_live_x")
    assert link.startswith(
        "cursor://anysphere.cursor-deeplink/mcp/install?name=supercharge&config="
    )
    b64 = link.split("config=", 1)[1]
    decoded = json.loads(base64.b64decode(b64).decode("utf-8"))
    assert decoded["url"] == "https://api.supercharge.so/mcp"
    assert decoded["headers"]["Authorization"] == "Bearer mcp_live_x"
