import assert from "node:assert/strict";
import { test } from "node:test";
import {
  connectionCommands,
  parseClaudeConnectionStatus,
  parseCodexConnectionStatus,
} from "../src/connections.mjs";

test("connection commands use host-native Kindling MCP names", () => {
  assert.deepEqual(connectionCommands("all"), [
    ["claude-code", "claude", ["mcp", "login", "plugin:kindling:kindling"]],
    ["codex", "codex", ["mcp", "login", "kindling"]],
  ]);
});

test("Claude connection status distinguishes connected and login-required", () => {
  assert.equal(
    parseClaudeConnectionStatus(
      "plugin:kindling:kindling: https://api.kindling.team/mcp (HTTP) - ✔ Connected",
    ),
    "connected",
  );
  assert.equal(
    parseClaudeConnectionStatus(
      "plugin:kindling:kindling: https://api.kindling.team/mcp (HTTP) - ! Needs authentication",
    ),
    "not_logged_in",
  );
  assert.equal(
    parseClaudeConnectionStatus(
      "plugin:kindling:kindling: https://api.kindling.team/mcp (HTTP) - ✘ Failed to connect",
    ),
    "unavailable",
  );
});

test("Codex connection status uses structured auth state", () => {
  assert.equal(
    parseCodexConnectionStatus(
      JSON.stringify([{ name: "kindling", auth_status: "oauth" }]),
    ),
    "connected",
  );
  assert.equal(
    parseCodexConnectionStatus(
      JSON.stringify([{ name: "kindling", auth_status: "not_logged_in" }]),
    ),
    "not_logged_in",
  );
});
