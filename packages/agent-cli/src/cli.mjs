import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolve } from "node:path";
import YAML from "yaml";
import { PLUGIN_VERSION } from "./constants.mjs";
import {
  connectionCommands,
  connectionServerName,
  parseClaudeConnectionStatus,
  parseCodexConnectionStatus,
} from "./connections.mjs";
import { configureEnvironment, getEnvironmentProfile } from "./profiles.mjs";
import { parseApprovalPrompt, recordApproval } from "./approval.mjs";
import { runHook } from "./hooks.mjs";
import {
  defaultPolicy,
  loadPolicy,
  policyDigest,
  renderPolicy,
} from "./policy.mjs";
import {
  atomicWrite,
  ensurePrivateLayout,
  findKindlingDir,
  kindlingPaths,
  pathExists,
  readLedger,
} from "./paths.mjs";
import { createReport, renderReportMarkdown } from "./report.mjs";
import { sourceContentDigest, sourceStatusFromDigest } from "./sources.mjs";

function parseArguments(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const [rawKey, inline] = value.slice(2).split("=", 2);
    if (inline !== undefined) {
      options[rawKey] = inline;
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options[rawKey] = next;
      index += 1;
    } else {
      options[rawKey] = true;
    }
  }
  return { options, positional };
}

function splitCommaList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readStdinJson() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text.trim() ? JSON.parse(text) : {};
}

async function readStdinText() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

function print(value = "") {
  process.stdout.write(`${value}\n`);
}

function printJson(value) {
  print(JSON.stringify(value));
}

async function prompt(question, fallback = "") {
  const reader = createInterface({ input, output });
  try {
    const suffix = fallback ? ` [${fallback}]` : "";
    const answer = (await reader.question(`${question}${suffix}: `)).trim();
    return answer || fallback;
  } finally {
    reader.close();
  }
}

async function coldStart(options) {
  const profile = getEnvironmentProfile();
  const cwd = resolve(String(options.cwd ?? process.cwd()));
  const kindlingDir = await findKindlingDir(cwd, { create: true });
  const paths = await ensurePrivateLayout(kindlingDir);
  if ((await pathExists(paths.policy)) && !options.force) {
    throw new Error(
      `${paths.policy} already exists; use --force only to replace it intentionally`,
    );
  }

  let policy;
  if (options["config-json"]) {
    const config = JSON.parse(
      await readFile(resolve(String(options["config-json"])), "utf8"),
    );
    policy = defaultPolicy({
      approvalMinutes: config.approval_expires_minutes,
      blockedEntities: config.blocked_entities,
      blockedTopics: config.blocked_topics,
      organizationName: config.organization_name,
    });
  } else if (options.defaults || !process.stdin.isTTY) {
    if (!options.defaults && !process.stdin.isTTY) {
      throw new Error(
        "cold-start is interactive; use --defaults or --config-json in non-interactive mode",
      );
    }
    policy = defaultPolicy();
  } else {
    const organizationName = await prompt(
      "Organization display name",
      "Your company",
    );
    const blockedTopics = splitCommaList(
      await prompt(
        "Additional confidential topics, comma separated",
        "unreleased roadmap,pricing exceptions,security incidents,investor discussions",
      ),
    );
    const blockedEntities = splitCommaList(
      await prompt(
        "Confidential customer or project names, comma separated",
        "",
      ),
    );
    const approvalMinutes = Number(
      await prompt("Approval expiry in minutes", "30"),
    );
    policy = defaultPolicy({
      approvalMinutes,
      blockedEntities,
      blockedTopics,
      organizationName,
    });
  }
  await atomicWrite(paths.policy, renderPolicy(policy));
  print(`Created ${paths.policy}`);
  print(`Policy digest: ${policyDigest(policy)}`);
  print(
    `Next: connect the ${profile.displayName} MCP, then run the ${profile.sourceSkill} skill in run mode.`,
  );
}

async function resolveExistingPaths(options) {
  const cwd = resolve(String(options.cwd ?? process.cwd()));
  const kindlingDir = await findKindlingDir(cwd);
  if (!kindlingDir)
    throw new Error(
      "no .kindling/ingestion-policy.yaml found; run cold-start first",
    );
  return ensurePrivateLayout(kindlingDir);
}

async function validatePolicyCommand(options) {
  const paths = options.path
    ? kindlingPaths(resolve(String(options.path), ".."))
    : await resolveExistingPaths(options);
  const policy = await loadPolicy(
    options.path ? resolve(String(options.path)) : paths.policy,
  );
  print(
    `Policy valid: ${options.path ? resolve(String(options.path)) : paths.policy}`,
  );
  print(`Policy digest: ${policyDigest(policy)}`);
}

async function createReportCommand(options) {
  if (!options.input)
    throw new Error("report create requires --input <candidate-json>");
  const paths = await resolveExistingPaths(options);
  const reportInput = JSON.parse(
    await readFile(resolve(String(options.input)), "utf8"),
  );
  const report = await createReport({
    kindlingDir: paths.root,
    input: reportInput,
  });
  print(renderReportMarkdown(report));
}

async function approveCommand(positional, options) {
  const paths = await resolveExistingPaths(options);
  if (positional.length < 3) {
    throw new Error("approve requires REPORT_ID DIGEST_PREFIX CANDIDATES|ALL");
  }
  const parsed = parseApprovalPrompt(
    `APPROVE ${positional[0]} ${positional[1]} ${positional.slice(2).join(",")}`,
  );
  const result = await recordApproval(paths, parsed, { sessionId: null });
  print(
    `Approved ${result.selected.map((candidate) => candidate.id).join(", ")}`,
  );
}

async function auditCommand(options) {
  const paths = await resolveExistingPaths(options);
  const entries = await readLedger(paths.sent);
  if (!entries.length) {
    print("No Kindling ingestion receipts have been recorded.");
    return;
  }
  for (const entry of entries.slice(-100)) {
    print(
      `${entry.sent_at} ${entry.report_id}/${entry.candidate_id} source=${entry.source_id ?? "unknown"} status=${entry.status ?? "unknown"}`,
    );
  }
}

async function sourceCheckCommand(options) {
  if (!options["external-id"])
    throw new Error("source check requires --external-id");
  const paths = await resolveExistingPaths(options);
  let contentDigest = options["content-digest"]
    ? String(options["content-digest"])
    : null;
  if (!contentDigest && options["content-file"]) {
    contentDigest = sourceContentDigest(
      await readFile(resolve(String(options["content-file"])), "utf8"),
    );
  }
  if (!contentDigest) {
    const content = await readStdinText();
    if (!content) {
      throw new Error(
        "source check requires --content-digest, --content-file, or source text on stdin",
      );
    }
    contentDigest = sourceContentDigest(content);
  }
  const result = await sourceStatusFromDigest(paths, {
    contentDigest,
    externalId: String(options["external-id"]),
  });
  printJson(result);
}

async function sourceDigestCommand() {
  const content = await readStdinText();
  if (!content) throw new Error("source digest reads source text from stdin");
  print(sourceContentDigest(content));
}

function installationCommands(target) {
  const profile = getEnvironmentProfile();
  const commands = [];
  if (target === "claude-code" || target === "all") {
    commands.push([
      "claude",
      ["plugin", "marketplace", "add", "Kindling-Tech/supercharge-plugins"],
    ]);
    commands.push([
      "claude",
      ["plugin", "install", profile.pluginSelector, "--scope", "user"],
    ]);
  }
  if (target === "codex" || target === "all") {
    commands.push([
      "codex",
      ["plugin", "marketplace", "add", "Kindling-Tech/supercharge-plugins"],
    ]);
    commands.push(["codex", ["plugin", "add", profile.pluginSelector]]);
  }
  if (!commands.length)
    throw new Error("--target must be claude-code, codex, or all");
  return commands;
}

function renderCommand([command, args]) {
  return [
    command,
    ...args.map((value) =>
      /^[A-Za-z0-9_@./:-]+$/.test(value) ? value : JSON.stringify(value),
    ),
  ].join(" ");
}

async function runCommand(
  command,
  args,
  { allowedNoop = null, interactive = false, silent = false } = {},
) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: interactive
        ? "inherit"
        : [silent ? "ignore" : "inherit", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    if (child.stdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (!silent) process.stdout.write(chunk);
      });
    }
    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
        if (!silent) process.stderr.write(chunk);
      });
    }
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise({ stderr, stdout });
      else if (allowedNoop && allowedNoop.test(`${stdout}\n${stderr}`))
        resolvePromise({ stderr, stdout });
      else reject(new Error(`${command} exited with status ${code}`));
    });
  });
}

async function connectionStatus(host, profile = getEnvironmentProfile()) {
  if (host === "claude-code") {
    const result = await runCommand("claude", ["mcp", "list"], {
      silent: true,
    });
    return parseClaudeConnectionStatus(
      `${result.stdout}\n${result.stderr}`,
      profile,
    );
  }
  const result = await runCommand("codex", ["mcp", "list", "--json"], {
    silent: true,
  });
  return parseCodexConnectionStatus(result.stdout, profile);
}

function automaticConnectionEnabled() {
  const value = String(
    process.env.CLAUDE_PLUGIN_OPTION_AUTO_CONNECT ?? "true",
  ).toLowerCase();
  return !["0", "false", "no", "off"].includes(value);
}

async function connectCommand(options) {
  const profile = getEnvironmentProfile();
  const target = String(options.target ?? "all");
  const automatic = Boolean(options.automatic);
  if (automatic && target !== "claude-code") return;
  if (automatic && !automaticConnectionEnabled()) return;

  for (const [host, command, args] of connectionCommands(target, profile)) {
    let status;
    try {
      status = await connectionStatus(host, profile);
    } catch (error) {
      if (automatic) return;
      throw error;
    }
    if (status === "connected" && !options.force) {
      if (!automatic)
        print(`${profile.displayName} is already connected in ${host}.`);
      continue;
    }
    if (automatic && status !== "not_logged_in") return;
    if (status === "missing") {
      const expected = connectionServerName(host, profile);
      throw new Error(
        `${profile.displayName} MCP server ${expected} is not installed in ${host}`,
      );
    }
    try {
      await runCommand(command, args, {
        interactive: !automatic,
        silent: automatic,
      });
    } catch (error) {
      if (automatic) return;
      throw error;
    }
    if (!automatic) print(`${profile.displayName} connected in ${host}.`);
  }
}

async function installCommand(options) {
  const profile = getEnvironmentProfile();
  const target = String(options.target ?? "all");
  const commands = installationCommands(target);
  print("Planned commands:");
  for (const command of commands) print(`  ${renderCommand(command)}`);
  if (!options["no-connect"]) {
    print(`${profile.displayName} sign-in after installation:`);
    for (const [, command, args] of connectionCommands(target, profile)) {
      print(`  ${renderCommand([command, args])}`);
    }
  }
  if (!options.execute) {
    print("Dry run only. Add --execute to run these commands.");
    return;
  }
  if (!options.yes) {
    if (!process.stdin.isTTY)
      throw new Error("--execute in non-interactive mode also requires --yes");
    const answer = (
      await prompt("Run these commands? Type yes to continue", "no")
    ).toLowerCase();
    if (answer !== "yes") throw new Error("installation cancelled");
  }
  for (const [command, args] of commands) {
    await runCommand(command, args, {
      allowedNoop: /already (?:configured|exists|installed|added)|duplicate/i,
      interactive:
        (command === "claude" &&
          args[0] === "plugin" &&
          args[1] === "install") ||
        (command === "codex" && args[0] === "plugin" && args[1] === "add"),
    });
  }
  if (!options["no-connect"]) {
    await connectCommand({ target });
  }
  print(
    options["no-connect"]
      ? `Plugin installed. ${profile.displayName} sign-in was skipped by request.`
      : `Plugin installed and ${profile.displayName} connection is ready. Open a new host session and trust the plugin hooks when prompted.`,
  );
}

async function uninstallCommand(options) {
  const profile = getEnvironmentProfile();
  const target = String(options.target ?? "all");
  const commands = [];
  if (target === "claude-code" || target === "all") {
    commands.push(["claude", ["plugin", "uninstall", profile.pluginSelector]]);
  }
  if (target === "codex" || target === "all") {
    commands.push(["codex", ["plugin", "remove", profile.pluginSelector]]);
  }
  if (!commands.length)
    throw new Error("--target must be claude-code, codex, or all");
  print("Planned commands:");
  for (const command of commands) print(`  ${renderCommand(command)}`);
  if (!options.execute) {
    print(
      "Dry run only. Add --execute to run these commands. Customer policy and audit data are preserved.",
    );
    return;
  }
  if (!options.yes) throw new Error("uninstall --execute requires --yes");
  for (const [command, args] of commands) {
    await runCommand(command, args, {
      allowedNoop: /not (?:installed|found)|unknown plugin/i,
    });
  }
}

async function doctorCommand(options) {
  const profile = getEnvironmentProfile();
  const paths = await resolveExistingPaths(options);
  const policy = await loadPolicy(paths.policy);
  print(`Node: ${process.version}`);
  print(`Plugin runtime: ${PLUGIN_VERSION}`);
  print(`Policy: ${paths.policy}`);
  print(`Policy digest: ${policyDigest(policy)}`);
  print(`Environment: ${profile.environment}`);
  print(`${profile.displayName} MCP: ${profile.mcpUrl}`);
  print(
    "Claude Code: Kindling sign-in opens automatically after consent; use /plugins, /hooks, and /mcp for diagnostics.",
  );
  print(
    "Codex: authentication policy is ON_INSTALL; start a new task after installation or update.",
  );
}

function help() {
  print(`Kindling agent CLI ${PLUGIN_VERSION}

Usage:
  kindling-agent install --target claude-code|codex|all [--environment production|staging] [--execute --yes --no-connect]
  kindling-agent connect --target claude-code|codex|all [--environment production|staging] [--force]
  kindling-agent cold-start [--defaults | --config-json FILE] [--force]
  kindling-agent policy validate [--path FILE]
  kindling-agent report create --input FILE
  kindling-agent approve REPORT_ID DIGEST CANDIDATES|ALL
  kindling-agent source digest                         # reads text from stdin
  kindling-agent source check --external-id ID [--content-digest SHA256]
  kindling-agent audit
  kindling-agent doctor
  kindling-agent uninstall --target claude-code|codex|all [--environment production|staging] [--execute --yes]

Hook entrypoints (used by the plugin):
  kindling-agent prompt|before-write|after-write|write-failed
`);
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(nodeMajor) || nodeMajor < 20) {
    throw new Error("Node.js 20 or newer is required");
  }
  const [command, subcommand, ...rest] = process.argv.slice(2);
  if (
    ["prompt", "before-write", "after-write", "write-failed"].includes(command)
  ) {
    const result = await runHook(command, await readStdinJson());
    if (result) printJson(result);
    return;
  }
  const { options, positional } = parseArguments(
    command === "policy" || command === "report" || command === "source"
      ? rest
      : [subcommand, ...rest].filter((value) => value !== undefined),
  );
  configureEnvironment(options.environment);
  if (!command || command === "help" || options.help) return help();
  if (command === "version" || options.version) return print(PLUGIN_VERSION);
  if (command === "cold-start") return coldStart(options);
  if (command === "policy" && subcommand === "validate")
    return validatePolicyCommand(options);
  if (command === "report" && subcommand === "create")
    return createReportCommand(options);
  if (command === "approve") return approveCommand(positional, options);
  if (command === "source" && subcommand === "check")
    return sourceCheckCommand(options);
  if (command === "source" && subcommand === "digest")
    return sourceDigestCommand();
  if (command === "audit") return auditCommand(options);
  if (command === "doctor") return doctorCommand(options);
  if (command === "install") return installCommand(options);
  if (command === "connect") return connectCommand(options);
  if (command === "uninstall") return uninstallCommand(options);
  throw new Error(
    `unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`,
  );
}

main().catch((error) => {
  process.stderr.write(`kindling-agent: ${error.message}\n`);
  process.exitCode = 1;
});
