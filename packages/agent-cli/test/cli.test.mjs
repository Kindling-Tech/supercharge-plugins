import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const execFileAsync = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const cli = join(root, "packages/agent-cli/dist/kindling-agent.cjs");

async function run(args, cwd) {
  return execFileAsync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("cold-start defaults creates and validates a private policy layout", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-"));
  const created = await run(["cold-start", "--defaults", "--cwd", cwd], cwd);
  assert.match(created.stdout, /Created .*ingestion-policy\.yaml/);
  await access(join(cwd, ".kindling/ingestion-policy.yaml"));
  await access(join(cwd, ".kindling/.gitignore"));
  const validated = await run(["policy", "validate", "--cwd", cwd], cwd);
  assert.match(validated.stdout, /Policy valid/);
});

test("cold-start config preserves safety decisions without accepting a tenant label", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-config-"));
  const configPath = join(cwd, "cold-start.json");
  await writeFile(
    configPath,
    JSON.stringify({
      approval_expires_minutes: 45,
      blocked_entities: ["Private Customer", "Secret Project"],
      blocked_topics: ["unreleased launch"],
      organization_name: "Untrusted local tenant label",
    }),
  );

  await run(["cold-start", "--config-json", configPath, "--cwd", cwd], cwd);

  const policy = YAML.parse(
    await readFile(join(cwd, ".kindling/ingestion-policy.yaml"), "utf8"),
  );
  assert.equal(
    policy.organization.display_name,
    "OAuth-connected Kindling workspace",
  );
  assert.deepEqual(policy.sensitive.blocked_topics, ["unreleased launch"]);
  assert.deepEqual(policy.sensitive.blocked_entities, [
    { name: "Private Customer", category: "confidential_entity" },
    { name: "Secret Project", category: "confidential_entity" },
  ]);
  assert.equal(policy.review.approval_expires_minutes, 45);
});

test("cold-start refuses accidental replacement", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-"));
  await run(["cold-start", "--defaults", "--cwd", cwd], cwd);
  await assert.rejects(
    () => run(["cold-start", "--defaults", "--cwd", cwd], cwd),
    /already exists/,
  );
});

test("install is dry-run by default and emits real host commands", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-"));
  const result = await run(["install", "--target", "all"], cwd);
  assert.match(
    result.stdout,
    /claude plugin marketplace add Kindling-Tech\/supercharge-plugins/,
  );
  assert.match(result.stdout, /codex plugin add kindling@supercharge/);
  assert.match(result.stdout, /claude mcp login plugin:kindling:kindling/);
  assert.match(result.stdout, /codex mcp login kindling/);
  assert.match(result.stdout, /enable auto-update once/);
  assert.match(result.stdout, /Dry run only/);
});

test("staging install emits isolated plugin and MCP commands", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-"));
  const result = await run(
    ["install", "--target", "all", "--environment", "staging"],
    cwd,
  );
  assert.match(
    result.stdout,
    /claude plugin install kindling-staging@supercharge --scope user/,
  );
  assert.match(
    result.stdout,
    /claude mcp login plugin:kindling-staging:kindling-staging/,
  );
  assert.match(result.stdout, /codex plugin add kindling-staging@supercharge/);
  assert.match(result.stdout, /codex mcp login kindling-staging/);
});

test(
  "automatic Claude connection opens host-native login only when needed",
  { skip: process.platform === "win32" },
  async () => {
    const cwd = await mkdtemp(join(tmpdir(), "kindling-connect-"));
    const bin = join(cwd, "bin");
    const log = join(cwd, "calls.jsonl");
    await mkdir(bin);
    const fakeClaude = join(bin, "claude");
    await writeFile(
      fakeClaude,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.KINDLING_TEST_CALL_LOG, JSON.stringify(args) + "\\n");
if (args.join(" ") === "mcp list") {
  console.log("plugin:kindling:kindling: https://api.kindling.team/mcp (HTTP) - ! Needs authentication");
  process.exit(0);
}
if (args.join(" ") === "mcp login plugin:kindling:kindling") process.exit(0);
process.exit(2);
`,
      "utf8",
    );
    await chmod(fakeClaude, 0o755);

    const result = await execFileAsync(
      process.execPath,
      [cli, "connect", "--target", "claude-code", "--automatic"],
      {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          KINDLING_TEST_CALL_LOG: log,
          PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
        },
      },
    );
    assert.equal(result.stdout, "");
    const calls = (await readFile(log, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(calls, [
      ["mcp", "list"],
      ["mcp", "login", "plugin:kindling:kindling"],
    ]);
  },
);

test(
  "Codex connection opens host-native login for an installed unlinked MCP",
  { skip: process.platform === "win32" },
  async () => {
    const cwd = await mkdtemp(join(tmpdir(), "kindling-connect-"));
    const bin = join(cwd, "bin");
    const log = join(cwd, "calls.jsonl");
    await mkdir(bin);
    const fakeCodex = join(bin, "codex");
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.KINDLING_TEST_CALL_LOG, JSON.stringify(args) + "\\n");
if (args.join(" ") === "mcp list --json") {
  console.log(JSON.stringify([{ name: "kindling", auth_status: "not_logged_in" }]));
  process.exit(0);
}
if (args.join(" ") === "mcp login kindling") process.exit(0);
process.exit(2);
`,
      "utf8",
    );
    await chmod(fakeCodex, 0o755);

    const result = await execFileAsync(
      process.execPath,
      [cli, "connect", "--target", "codex"],
      {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          KINDLING_TEST_CALL_LOG: log,
          PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
        },
      },
    );
    assert.match(result.stdout, /Kindling connected in codex/);
    const calls = (await readFile(log, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(calls, [
      ["mcp", "list", "--json"],
      ["mcp", "login", "kindling"],
    ]);
  },
);

test("uninstall uses host-valid marketplace-qualified selectors", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-"));
  const result = await run(["uninstall", "--target", "all"], cwd);
  assert.match(result.stdout, /claude plugin uninstall kindling@supercharge/);
  assert.match(result.stdout, /codex plugin remove kindling@supercharge/);
  assert.match(result.stdout, /Dry run only/);
});

test("staging uninstall uses its own marketplace-qualified selectors", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-"));
  const result = await run(
    ["uninstall", "--target", "all", "--environment", "staging"],
    cwd,
  );
  assert.match(
    result.stdout,
    /claude plugin uninstall kindling-staging@supercharge/,
  );
  assert.match(
    result.stdout,
    /codex plugin remove kindling-staging@supercharge/,
  );
});

test("source check keeps source content out of stdout", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-"));
  await run(["cold-start", "--defaults", "--cwd", cwd], cwd);
  const contentPath = join(cwd, ".kindling/state/source.txt");
  await writeFile(contentPath, "Private source text", "utf8");
  const result = await run(
    [
      "source",
      "check",
      "--cwd",
      cwd,
      "--external-id",
      "meeting-private-id",
      "--content-file",
      contentPath,
    ],
    cwd,
  );
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.status, "new");
  assert.doesNotMatch(result.stdout, /Private source text|meeting-private-id/);
});
