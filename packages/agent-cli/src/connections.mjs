export const CLAUDE_KINDLING_SERVER = "plugin:kindling:kindling";
export const CODEX_KINDLING_SERVER = "kindling";

export function connectionCommands(target) {
  const commands = [];
  if (target === "claude-code" || target === "all") {
    commands.push([
      "claude-code",
      "claude",
      ["mcp", "login", CLAUDE_KINDLING_SERVER],
    ]);
  }
  if (target === "codex" || target === "all") {
    commands.push(["codex", "codex", ["mcp", "login", CODEX_KINDLING_SERVER]]);
  }
  if (!commands.length) {
    throw new Error("--target must be claude-code, codex, or all");
  }
  return commands;
}

export function parseClaudeConnectionStatus(output) {
  const line = String(output)
    .split(/\r?\n/)
    .find((candidate) =>
      candidate.trimStart().startsWith(`${CLAUDE_KINDLING_SERVER}:`),
    );
  if (!line) return "missing";
  if (/\bConnected\b/i.test(line)) return "connected";
  if (/Needs authentication/i.test(line)) return "not_logged_in";
  return "unavailable";
}

export function parseCodexConnectionStatus(output) {
  let servers;
  try {
    servers = JSON.parse(String(output));
  } catch {
    return "unavailable";
  }
  if (!Array.isArray(servers)) return "unavailable";
  const server = servers.find(
    (candidate) => candidate?.name === CODEX_KINDLING_SERVER,
  );
  if (!server) return "missing";
  const status = String(server.auth_status ?? "").toLowerCase();
  if (status === "oauth") return "connected";
  if (status === "not_logged_in" || status === "notloggedin") {
    return "not_logged_in";
  }
  return "unavailable";
}
