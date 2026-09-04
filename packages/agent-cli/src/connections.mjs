import { getEnvironmentProfile } from "./profiles.mjs";

export function connectionCommands(target, profile = getEnvironmentProfile()) {
  const commands = [];
  if (target === "claude-code" || target === "all") {
    commands.push([
      "claude-code",
      "claude",
      ["mcp", "login", profile.claudeServer],
    ]);
  }
  if (target === "codex" || target === "all") {
    commands.push(["codex", "codex", ["mcp", "login", profile.codexServer]]);
  }
  if (!commands.length) {
    throw new Error("--target must be claude-code, codex, or all");
  }
  return commands;
}

export function connectionServerName(host, profile = getEnvironmentProfile()) {
  return host === "claude-code" ? profile.claudeServer : profile.codexServer;
}

export function parseClaudeConnectionStatus(
  output,
  profile = getEnvironmentProfile(),
) {
  const line = String(output)
    .split(/\r?\n/)
    .find((candidate) =>
      candidate.trimStart().startsWith(`${profile.claudeServer}:`),
    );
  if (!line) return "missing";
  if (/\bConnected\b/i.test(line)) return "connected";
  if (/Needs authentication/i.test(line)) return "not_logged_in";
  return "unavailable";
}

export function parseCodexConnectionStatus(
  output,
  profile = getEnvironmentProfile(),
) {
  let servers;
  try {
    servers = JSON.parse(String(output));
  } catch {
    return "unavailable";
  }
  if (!Array.isArray(servers)) return "unavailable";
  const server = servers.find(
    (candidate) => candidate?.name === profile.codexServer,
  );
  if (!server) return "missing";
  const status = String(server.auth_status ?? "").toLowerCase();
  if (status === "oauth") return "connected";
  if (status === "not_logged_in" || status === "notloggedin") {
    return "not_logged_in";
  }
  return "unavailable";
}
