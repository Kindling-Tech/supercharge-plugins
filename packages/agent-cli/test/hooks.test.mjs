import assert from "node:assert/strict";
import { test } from "node:test";
import { createReport } from "../src/report.mjs";
import {
  handleAfterWrite,
  handleBeforeWrite,
  handleUserPrompt,
  handleWriteFailure,
} from "../src/hooks.mjs";
import { readLedger } from "../src/paths.mjs";
import { safeReportInput, temporaryWorkspace } from "./helpers.mjs";
import { renderPolicy } from "../src/policy.mjs";
import { writeFile } from "node:fs/promises";

const NOW = new Date("2026-08-31T10:15:00.000Z");
const REPORT_ID = "KIR-20260831-101500-ab12";
const TOOL_NAME = "mcp__kindling__add_knowledge";

async function setup() {
  const workspace = await temporaryWorkspace();
  const report = await createReport({
    kindlingDir: workspace.kindlingDir,
    input: safeReportInput(),
    now: NOW,
    reportId: REPORT_ID,
  });
  const candidate = report.candidates[0];
  const payload = {
    cwd: workspace.root,
    session_id: "session-1",
    tool_input: candidate.tool_input,
    tool_name: TOOL_NAME,
  };
  return { ...workspace, candidate, payload, report };
}

test("ingestion intent suggests the source skill without authorizing a write", async () => {
  const { root } = await temporaryWorkspace();
  const result = await handleUserPrompt(
    {
      cwd: root,
      prompt: "Please ingest my latest Granola meetings",
      session_id: "session-1",
    },
    NOW,
  );
  assert.match(
    result.hookSpecificOutput.additionalContext,
    /kindling-source-ingestion/,
  );
  assert.doesNotMatch(
    result.hookSpecificOutput.additionalContext,
    /call add_knowledge now/i,
  );
});

test("ambiguous praise is not approval", async () => {
  const { root } = await temporaryWorkspace();
  assert.equal(
    await handleUserPrompt(
      { cwd: root, prompt: "Looks good to me", session_id: "session-1" },
      NOW,
    ),
    null,
  );
});

test("unapproved write is denied", async () => {
  const { payload } = await setup();
  const result = await handleBeforeWrite(payload, NOW);
  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
  assert.match(
    result.hookSpecificOutput.permissionDecisionReason,
    /active user-approved review receipt/,
  );
});

test("exact user approval unlocks only exact reviewed arguments", async () => {
  const { candidate, payload, report, root } = await setup();
  const approvalPrompt = `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} ${candidate.id}`;
  const approval = await handleUserPrompt(
    { cwd: root, prompt: approvalPrompt, session_id: "session-1" },
    NOW,
  );
  assert.match(approval.hookSpecificOutput.additionalContext, /was recorded/);
  assert.equal(await handleBeforeWrite(payload, NOW), null);

  const changed = {
    ...payload,
    tool_input: {
      ...payload.tool_input,
      content: `${payload.tool_input.content} Changed.`,
    },
  };
  const denied = await handleBeforeWrite(changed, NOW);
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
});

test("wrong digest does not create approval", async () => {
  const { candidate, payload, report, root } = await setup();
  const result = await handleUserPrompt(
    {
      cwd: root,
      prompt: `APPROVE ${report.report_id} 000000000000 ${candidate.id}`,
      session_id: "session-1",
    },
    NOW,
  );
  assert.match(result.hookSpecificOutput.additionalContext, /was not recorded/);
  assert.equal(
    (await handleBeforeWrite(payload, NOW)).hookSpecificOutput
      .permissionDecision,
    "deny",
  );
});

test("approval is bound to the approving session", async () => {
  const { candidate, payload, report, root } = await setup();
  await handleUserPrompt(
    {
      cwd: root,
      prompt: `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} ${candidate.id}`,
      session_id: "session-1",
    },
    NOW,
  );
  const denied = await handleBeforeWrite(
    { ...payload, session_id: "session-2" },
    NOW,
  );
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
});

test("expired approval is denied", async () => {
  const { candidate, payload, report, root } = await setup();
  await handleUserPrompt(
    {
      cwd: root,
      prompt: `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} ${candidate.id}`,
      session_id: "session-1",
    },
    NOW,
  );
  const later = new Date("2026-08-31T11:00:01.000Z");
  const denied = await handleBeforeWrite(payload, later);
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
});

test("success records metadata, consumes approval, and never logs content", async () => {
  const { candidate, paths, payload, report, root } = await setup();
  await handleUserPrompt(
    {
      cwd: root,
      prompt: `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} ${candidate.id}`,
      session_id: "session-1",
    },
    NOW,
  );
  await handleAfterWrite(
    {
      ...payload,
      tool_response: {
        source_id: "SRC_TEST_123",
        status: "accepted_for_compilation",
      },
    },
    NOW,
  );
  const sent = await readLedger(paths.sent);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].source_id, "SRC_TEST_123");
  assert.equal(sent[0].status, "accepted_for_compilation");
  assert.equal(
    JSON.stringify(sent).includes(candidate.tool_input.content),
    false,
  );
  const denied = await handleBeforeWrite(payload, NOW);
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
});

test("failure log is metadata-only and leaves approval retryable", async () => {
  const { candidate, paths, payload, report, root } = await setup();
  await handleUserPrompt(
    {
      cwd: root,
      prompt: `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} ${candidate.id}`,
      session_id: "session-1",
    },
    NOW,
  );
  await handleWriteFailure(
    {
      ...payload,
      tool_response: { error: `Rejected ${candidate.tool_input.content}` },
    },
    NOW,
  );
  const failures = await readLedger(paths.failures);
  assert.equal(failures.length, 1);
  assert.equal(
    JSON.stringify(failures).includes(candidate.tool_input.content),
    false,
  );
  assert.equal(await handleBeforeWrite(payload, NOW), null);
});

test("rejected report cannot authorize its candidates", async () => {
  const { payload, report, root } = await setup();
  const result = await handleUserPrompt(
    {
      cwd: root,
      prompt: `REJECT ${report.report_id} ${report.report_digest.slice(0, 12)}`,
      session_id: "session-1",
    },
    NOW,
  );
  assert.match(result.hookSpecificOutput.additionalContext, /was rejected/);
  assert.equal(
    (await handleBeforeWrite(payload, NOW)).hookSpecificOutput
      .permissionDecision,
    "deny",
  );
});

test("policy change after approval invalidates the write", async () => {
  const { candidate, paths, payload, policy, report, root } = await setup();
  await handleUserPrompt(
    {
      cwd: root,
      prompt: `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} ${candidate.id}`,
      session_id: "session-1",
    },
    NOW,
  );
  policy.sensitive.blocked_topics.push("new confidential topic");
  await writeFile(paths.policy, renderPolicy(policy), "utf8");
  const denied = await handleBeforeWrite(payload, NOW);
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
  assert.match(
    denied.hookSpecificOutput.permissionDecisionReason,
    /policy changed/,
  );
});

test("ALL approval honors customer policy", async () => {
  const workspace = await temporaryWorkspace();
  workspace.policy.review.allow_approve_all = false;
  await writeFile(
    workspace.paths.policy,
    renderPolicy(workspace.policy),
    "utf8",
  );
  const report = await createReport({
    kindlingDir: workspace.kindlingDir,
    input: safeReportInput(),
    now: NOW,
    reportId: REPORT_ID,
  });
  const result = await handleUserPrompt(
    {
      cwd: workspace.root,
      prompt: `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} ALL`,
      session_id: "session-1",
    },
    NOW,
  );
  assert.match(
    result.hookSpecificOutput.additionalContext,
    /does not permit approve-all/,
  );
});
