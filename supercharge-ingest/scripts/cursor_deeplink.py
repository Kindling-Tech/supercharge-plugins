#!/usr/bin/env python3
"""Generate a Cursor one-click "Add to Cursor" MCP install deeplink.

Usage:
  python3 cursor_deeplink.py --url https://api.supercharge.so/mcp --token mcp_live_xxx
  SUPERCHARGE_MCP_URL=... SUPERCHARGE_MCP_TOKEN=... python3 cursor_deeplink.py

Prints the deeplink. The format is:
  cursor://anysphere.cursor-deeplink/mcp/install?name=<name>&config=<base64(json)>

NOTE: the deeplink embeds the bearer token, so treat the output as a secret and
generate it per-customer (e.g. in the authenticated Supercharge app), never
commit a real one.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys

SERVER_NAME = "supercharge"


def build_config(url: str, token: str) -> dict:
    """The Cursor MCP server config object that gets base64-encoded."""
    return {"url": url, "headers": {"Authorization": f"Bearer {token}"}}


def build_deeplink(name: str, url: str, token: str) -> str:
    cfg = build_config(url, token)
    b64 = base64.b64encode(json.dumps(cfg).encode("utf-8")).decode("ascii")
    return f"cursor://anysphere.cursor-deeplink/mcp/install?name={name}&config={b64}"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate a Cursor MCP install deeplink for the supercharge server."
    )
    parser.add_argument("--name", default=SERVER_NAME)
    parser.add_argument("--url", default=os.environ.get("SUPERCHARGE_MCP_URL"))
    parser.add_argument("--token", default=os.environ.get("SUPERCHARGE_MCP_TOKEN"))
    args = parser.parse_args(argv)
    if not args.url or not args.token:
        parser.error("provide --url/--token or set SUPERCHARGE_MCP_URL and SUPERCHARGE_MCP_TOKEN")
    print(build_deeplink(args.name, args.url, args.token))
    return 0


if __name__ == "__main__":
    sys.exit(main())
