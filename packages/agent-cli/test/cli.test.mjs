import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

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
  assert.match(result.stdout, /Dry run only/);
});

test("uninstall uses host-valid marketplace-qualified selectors", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-cli-"));
  const result = await run(["uninstall", "--target", "all"], cwd);
  assert.match(result.stdout, /claude plugin uninstall kindling@supercharge/);
  assert.match(result.stdout, /codex plugin remove kindling@supercharge/);
  assert.match(result.stdout, /Dry run only/);
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
