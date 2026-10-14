import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { sourceContentDigest } from "../src/sources.mjs";

const exec = promisify(execFile);
const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const version = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
).version;

async function exists(path) {
  return stat(path).then(
    () => true,
    () => false,
  );
}

test("OpenAI bundle ships without hooks and records approval through the CLI", async () => {
  await exec(process.execPath, [join(root, "scripts/build-openai-bundle.mjs")]);
  const unpacked = await mkdtemp(join(tmpdir(), "kindling-openai-"));
  await exec("unzip", [
    "-q",
    join(root, `release/kindling-openai-${version}.zip`),
    "-d",
    unpacked,
  ]);

  assert.equal(await exists(join(unpacked, "hooks")), false);
  assert.equal(await exists(join(unpacked, "dist")), false);
  assert.equal(await exists(join(unpacked, ".codex-plugin")), false);
  const manifest = JSON.parse(
    await readFile(join(unpacked, "plugin.json"), "utf8"),
  );
  assert.equal(manifest.name, "kindling");
  assert.equal(manifest.version, version);
  const listing = manifest.extensions["com.openai"].interface;
  assert.ok(listing.shortDescription.length <= 30);
  assert.ok(listing.defaultPrompt.length <= 3);
  for (const key of [
    "websiteURL",
    "supportURL",
    "privacyPolicyURL",
    "termsOfServiceURL",
  ]) {
    assert.match(listing[key], /^https:\/\//, `${key} missing`);
  }
  const mcp = JSON.parse(await readFile(join(unpacked, "mcp.json"), "utf8"));
  assert.deepEqual(mcp.mcpServers.kindling, {
    type: "streamable-http",
    url: "https://api.kindling.team/mcp",
  });

  const cli = join(
    unpacked,
    "skills/kindling-source-ingestion/scripts/kindling.cjs",
  );
  const run = (args, cwd) => exec(process.execPath, [cli, ...args], { cwd });
  const cwd = await mkdtemp(join(tmpdir(), "kindling-openai-run-"));
  await run(["cold-start", "--defaults", "--cwd", cwd], cwd);
  const inputPath = join(cwd, ".kindling/state/report-input.json");
  await writeFile(
    inputPath,
    JSON.stringify({
      source: {
        provider: "connected-source",
        items: [
          {
            content_digest: sourceContentDigest("Raw source text."),
            external_id: "private-meeting-id",
            observed_at: "2026-08-31T09:00:00Z",
          },
        ],
      },
      candidates: [
        {
          content: "Public buyers value a clear implementation timeline.",
          id: "KI-001",
          reason: "Durable generalized buying signal.",
          removed: [],
          title: "Implementation expectations",
        },
      ],
      withheld: [],
    }),
    "utf8",
  );
  await run(["report", "create", "--cwd", cwd, "--input", inputPath], cwd);
  const reportFile = (await readdir(join(cwd, ".kindling/reports"))).find(
    (name) => name.endsWith(".json"),
  );
  const report = JSON.parse(
    await readFile(join(cwd, ".kindling/reports", reportFile), "utf8"),
  );

  await assert.rejects(
    run(
      ["approve", report.report_id, "000000000000", "KI-001", "--cwd", cwd],
      cwd,
    ),
    /digest does not match/,
  );
  const approved = await run(
    [
      "approve",
      report.report_id,
      report.report_digest.slice(0, 12),
      "KI-001",
      "--cwd",
      cwd,
    ],
    cwd,
  );
  assert.match(approved.stdout, /Approved KI-001/);
});
