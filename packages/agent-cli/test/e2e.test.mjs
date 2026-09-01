import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceContentDigest } from "../src/sources.mjs";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const cli = join(root, "plugins/kindling/dist/kindling-guard.cjs");

async function run(args, { cwd, stdin = "" }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise({ stderr, stdout });
      else reject(new Error(`exit ${code}: ${stderr}`));
    });
    child.stdin.end(stdin);
  });
}

test("shipped bundle enforces report approval and records a redacted receipt end to end", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "kindling-e2e-"));
  await run(["cold-start", "--defaults", "--cwd", cwd], { cwd });

  const reportInput = {
    source: {
      provider: "granola",
      items: [
        {
          content_digest: sourceContentDigest(
            "Raw source text that must not enter the audit ledger.",
          ),
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
        removed: ["participant_names"],
        title: "Implementation expectations",
      },
    ],
    withheld: [{ code: "private_attribution", count: 1 }],
  };
  const inputPath = join(cwd, ".kindling/state/report-input.json");
  await writeFile(inputPath, JSON.stringify(reportInput), "utf8");
  await run(["report", "create", "--cwd", cwd, "--input", inputPath], { cwd });

  const reportFile = (await readdir(join(cwd, ".kindling/reports"))).find(
    (name) => name.endsWith(".json"),
  );
  const report = JSON.parse(
    await readFile(join(cwd, ".kindling/reports", reportFile), "utf8"),
  );
  const toolPayload = {
    cwd,
    session_id: "bundle-session",
    tool_input: report.candidates[0].tool_input,
    tool_name: "mcp__kindling__add_knowledge",
  };

  const denied = await run(["before-write"], {
    cwd,
    stdin: JSON.stringify(toolPayload),
  });
  assert.equal(
    JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision,
    "deny",
  );

  const approvalPrompt = `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} KI-001`;
  const approved = await run(["prompt"], {
    cwd,
    stdin: JSON.stringify({
      cwd,
      prompt: approvalPrompt,
      session_id: "bundle-session",
    }),
  });
  assert.match(
    JSON.parse(approved.stdout).hookSpecificOutput.additionalContext,
    /was recorded/,
  );

  const allowed = await run(["before-write"], {
    cwd,
    stdin: JSON.stringify(toolPayload),
  });
  assert.equal(allowed.stdout, "");

  await run(["after-write"], {
    cwd,
    stdin: JSON.stringify({
      ...toolPayload,
      tool_response: {
        source_id: "SRC_BUNDLE_1",
        status: "accepted_for_compilation",
      },
    }),
  });

  const audit = await run(["audit", "--cwd", cwd], { cwd });
  assert.match(audit.stdout, /SRC_BUNDLE_1/);
  assert.doesNotMatch(
    audit.stdout,
    /Raw source text|private-meeting-id|Public buyers/,
  );

  const consumed = await run(["before-write"], {
    cwd,
    stdin: JSON.stringify(toolPayload),
  });
  assert.equal(
    JSON.parse(consumed.stdout).hookSpecificOutput.permissionDecision,
    "deny",
  );
});
