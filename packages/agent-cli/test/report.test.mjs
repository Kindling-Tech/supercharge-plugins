import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import {
  createReport,
  loadReport,
  renderReportMarkdown,
} from "../src/report.mjs";
import { sourceStatus } from "../src/sources.mjs";
import {
  fileText,
  SAFE_SOURCE_TEXT,
  safeReportInput,
  temporaryWorkspace,
} from "./helpers.mjs";
import { renderPolicy } from "../src/policy.mjs";

const NOW = new Date("2026-08-31T10:15:00.000Z");
const REPORT_ID = "KIR-20260831-101500-ab12";

test("report persists exact safe inputs and withholds deterministic findings", async () => {
  const { kindlingDir, paths } = await temporaryWorkspace();
  const input = safeReportInput();
  input.candidates.push({
    content: "The confidential price is $45,000 AUD for person@example.com.",
    id: "KI-002",
    reason: "Should be withheld.",
    removed: [],
    title: "Commercial terms",
  });
  const report = await createReport({
    kindlingDir,
    input,
    now: NOW,
    reportId: REPORT_ID,
  });
  assert.equal(report.candidates.length, 1);
  assert.equal(
    report.candidates[0].tool_input.connector_label,
    "granola-reviewed",
  );
  assert.equal(report.candidates[0].tool_input.origin_uri, null);
  assert.ok(
    report.withheld.some((item) => item.code === "exact_commercial_value"),
  );
  assert.ok(report.withheld.some((item) => item.code === "personal_email"));

  const jsonText = await fileText(join(paths.reports, `${REPORT_ID}.json`));
  assert.doesNotMatch(jsonText, /45,000|person@example\.com/);
  assert.deepEqual(await loadReport(paths, REPORT_ID), report);
});

test("report markdown displays exact payload and approval command", async () => {
  const { kindlingDir } = await temporaryWorkspace();
  const report = await createReport({
    kindlingDir,
    input: safeReportInput(),
    now: NOW,
    reportId: REPORT_ID,
  });
  const markdown = renderReportMarkdown(report);
  assert.match(markdown, /Exact content to send/);
  assert.match(
    markdown,
    new RegExp(`APPROVE ${REPORT_ID} ${report.report_digest.slice(0, 12)}`),
  );
  assert.match(markdown, /KI-001/);
});

test("editing a stored report fails integrity validation", async () => {
  const { kindlingDir, paths } = await temporaryWorkspace();
  const report = await createReport({
    kindlingDir,
    input: safeReportInput(),
    now: NOW,
    reportId: REPORT_ID,
  });
  report.candidates[0].tool_input.content = "Changed after review";
  await writeFile(
    join(paths.reports, `${REPORT_ID}.json`),
    JSON.stringify(report),
    "utf8",
  );
  await assert.rejects(() => loadReport(paths, REPORT_ID), /integrity check/);
});

test("private origin URI is rejected", async () => {
  const { kindlingDir } = await temporaryWorkspace();
  const input = safeReportInput();
  input.candidates[0].origin_uri = "https://notes.granola.ai/d/private-id";
  await assert.rejects(
    () => createReport({ kindlingDir, input, now: NOW, reportId: REPORT_ID }),
    /origin_uri must be omitted/,
  );
});

test("report records source revision without raw external ID", async () => {
  const { kindlingDir, paths } = await temporaryWorkspace();
  const input = safeReportInput();
  await createReport({ kindlingDir, input, now: NOW, reportId: REPORT_ID });
  const source = input.source.items[0];
  const result = await sourceStatus(paths, {
    content: SAFE_SOURCE_TEXT,
    externalId: source.external_id,
  });
  assert.equal(result.status, "unchanged");
  const ledger = await fileText(paths.sources);
  assert.doesNotMatch(ledger, /meeting-123/);
  assert.doesNotMatch(ledger, /stable public positioning/);
});

test("changed source content re-enters review", async () => {
  const { kindlingDir, paths } = await temporaryWorkspace();
  const input = safeReportInput();
  await createReport({ kindlingDir, input, now: NOW, reportId: REPORT_ID });
  const result = await sourceStatus(paths, {
    content: "Revised content",
    externalId: input.source.items[0].external_id,
  });
  assert.equal(result.status, "changed");
});

test("approval manifest persists even when Markdown report persistence is disabled", async () => {
  const { kindlingDir, paths, policy } = await temporaryWorkspace();
  policy.review.persist_safe_reports = false;
  await writeFile(paths.policy, renderPolicy(policy), "utf8");
  await createReport({
    kindlingDir,
    input: safeReportInput(),
    now: NOW,
    reportId: REPORT_ID,
  });
  await assert.doesNotReject(() => loadReport(paths, REPORT_ID));
  await assert.rejects(
    () => fileText(join(paths.reports, `${REPORT_ID}.md`)),
    /ENOENT/,
  );
});

test("report rejects unknown fields and raw source content", async () => {
  const { kindlingDir } = await temporaryWorkspace();
  const input = safeReportInput();
  input.source.items[0].content = "Raw note text";
  await assert.rejects(
    () => createReport({ kindlingDir, input, now: NOW, reportId: REPORT_ID }),
    /content is not supported/,
  );
});

test("sensitive rationale withholds the candidate instead of persisting it", async () => {
  const { kindlingDir, paths } = await temporaryWorkspace();
  const input = safeReportInput();
  input.candidates[0].reason = "Confirmed by person@example.com";
  const report = await createReport({
    kindlingDir,
    input,
    now: NOW,
    reportId: REPORT_ID,
  });
  assert.equal(report.candidates.length, 0);
  const reportText = await fileText(join(paths.reports, `${REPORT_ID}.json`));
  assert.doesNotMatch(reportText, /person@example\.com/);
});
