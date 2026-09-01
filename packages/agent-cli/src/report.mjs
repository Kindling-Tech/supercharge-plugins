import { randomBytes } from "node:crypto";
import { join } from "node:path";
import {
  CANDIDATE_ID_PATTERN,
  MAX_CANDIDATES,
  MAX_CANDIDATE_BYTES,
  PLUGIN_VERSION,
  REPORT_ID_PATTERN,
} from "./constants.mjs";
import {
  canonicalize,
  isoNow,
  normalizeToolInput,
  sha256,
  toolInputDigest,
} from "./canonical.mjs";
import { loadPolicy, policyDigest, scanCandidate } from "./policy.mjs";
import {
  atomicWrite,
  ensurePrivateLayout,
  kindlingPaths,
  readUtf8,
} from "./paths.mjs";
import { localSourceKey, recordSourcesReviewed } from "./sources.mjs";

function rejectUnknown(value, allowed, field) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${field}.${key} is not supported`);
  }
}

function validateShortText(value, field, { required = true, max = 500 } = {}) {
  if ((value === undefined || value === null) && !required) return null;
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field} must be a non-empty string`);
  if (value.length > max) throw new Error(`${field} exceeds ${max} characters`);
  return value.trim();
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("report input must be an object");
  }
  rejectUnknown(input, new Set(["source", "candidates", "withheld"]), "report");
  const candidates = input.candidates;
  if (!Array.isArray(candidates) || candidates.length > MAX_CANDIDATES) {
    throw new Error(
      `candidates must be an array with at most ${MAX_CANDIDATES} items`,
    );
  }
  const source = input.source ?? {};
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("source must be an object");
  }
  rejectUnknown(source, new Set(["provider", "items"]), "source");
  const provider = validateShortText(
    source.provider ?? "manual",
    "source.provider",
    { max: 40 },
  );
  if (!new Set(["connected-source", "file", "manual", "web"]).has(provider)) {
    throw new Error(
      "source.provider must be connected-source, file, manual, or web",
    );
  }
  const sourceItems = Array.isArray(source.items) ? source.items : [];
  if (sourceItems.length > 100)
    throw new Error("source.items exceeds 100 items");
  return { candidates, provider, sourceItems, withheld: input.withheld ?? [] };
}

function buildReportId(now) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  return `KIR-${stamp}-${randomBytes(2).toString("hex")}`;
}

function safeWithheld(entries) {
  if (!Array.isArray(entries)) throw new Error("withheld must be an array");
  const result = [];
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`withheld[${index}] must be an object`);
    }
    rejectUnknown(entry, new Set(["code", "count"]), `withheld[${index}]`);
    const code = validateShortText(entry.code, `withheld[${index}].code`, {
      max: 80,
    });
    if (!/^[a-z0-9_-]+$/.test(code)) {
      throw new Error(`withheld[${index}].code must be a safe identifier`);
    }
    const count = Number(entry.count);
    if (!Number.isInteger(count) || count < 1 || count > 10_000) {
      throw new Error(`withheld[${index}].count must be a positive integer`);
    }
    result.push({ code, count });
  }
  return result;
}

function mergeWithheld(entries) {
  const counts = new Map();
  for (const entry of entries)
    counts.set(entry.code, (counts.get(entry.code) ?? 0) + entry.count);
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

async function normalizeSources(paths, provider, sourceItems) {
  const result = [];
  for (const [index, source] of sourceItems.entries()) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error(`source.items[${index}] must be an object`);
    }
    rejectUnknown(
      source,
      new Set(["external_id", "content_digest", "observed_at"]),
      `source.items[${index}]`,
    );
    const externalId = validateShortText(
      source.external_id,
      `source.items[${index}].external_id`,
      {
        max: 500,
      },
    );
    const contentDigest = validateShortText(
      source.content_digest,
      `source.items[${index}].content_digest`,
      { max: 64 },
    );
    if (!contentDigest || !/^[a-f0-9]{64}$/.test(contentDigest)) {
      throw new Error(
        `source.items[${index}] requires a SHA-256 content_digest`,
      );
    }
    result.push({
      content_digest: contentDigest,
      observed_at:
        source.observed_at === undefined || source.observed_at === null
          ? null
          : validateShortText(
              source.observed_at,
              `source.items[${index}].observed_at`,
              { max: 64 },
            ),
      provider,
      source_key: await localSourceKey(paths, externalId),
    });
  }
  return result;
}

function normalizeCandidate(raw, index, provider, policy) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`candidates[${index}] must be an object`);
  }
  rejectUnknown(
    raw,
    new Set(["id", "title", "content", "reason", "removed", "origin_uri"]),
    `candidates[${index}]`,
  );
  const id = validateShortText(raw.id, `candidates[${index}].id`, { max: 20 });
  if (!CANDIDATE_ID_PATTERN.test(id))
    throw new Error(`${id} must match KI-000`);
  const title = validateShortText(raw.title, `candidates[${index}].title`, {
    max: 200,
  });
  const content = validateShortText(
    raw.content,
    `candidates[${index}].content`,
    {
      max: MAX_CANDIDATE_BYTES,
    },
  );
  if (Buffer.byteLength(content, "utf8") > MAX_CANDIDATE_BYTES) {
    throw new Error(`${id} content exceeds ${MAX_CANDIDATE_BYTES} bytes`);
  }
  const reason = validateShortText(raw.reason, `candidates[${index}].reason`, {
    required: false,
    max: 500,
  });
  const removed = Array.isArray(raw.removed) ? raw.removed : [];
  for (const [removedIndex, value] of removed.entries()) {
    if (typeof value !== "string" || !/^[a-z0-9_-]+$/.test(value)) {
      throw new Error(
        `candidates[${index}].removed[${removedIndex}] must be a rule identifier`,
      );
    }
  }
  if (
    raw.origin_uri !== undefined &&
    raw.origin_uri !== null &&
    String(raw.origin_uri).trim()
  ) {
    throw new Error(
      `${id} origin_uri must be omitted; private source links are never sent`,
    );
  }
  const toolInput = normalizeToolInput({
    connector_label: `${provider}-reviewed`,
    content,
    origin_uri: null,
    title,
  });
  const findings = scanCandidate(
    { content: `${content}\n${reason ?? ""}`, title },
    policy,
  );
  return {
    findings,
    id,
    reason,
    removed: [...new Set(removed)].sort(),
    tool_input: toolInput,
    tool_input_digest: toolInputDigest(toolInput),
  };
}

export async function createReport({
  kindlingDir,
  input,
  now = new Date(),
  reportId = null,
}) {
  const paths = await ensurePrivateLayout(kindlingDir);
  const policy = await loadPolicy(paths.policy);
  const validated = validateInput(input);
  const id = reportId ?? buildReportId(now);
  if (!REPORT_ID_PATTERN.test(id)) throw new Error("report ID is invalid");

  const sourceRefs = await normalizeSources(
    paths,
    validated.provider,
    validated.sourceItems,
  );
  const included = [];
  const automaticWithheld = [];
  const seenIds = new Set();
  for (const [index, raw] of validated.candidates.entries()) {
    const candidate = normalizeCandidate(
      raw,
      index,
      validated.provider,
      policy,
    );
    if (seenIds.has(candidate.id))
      throw new Error(`duplicate candidate ID ${candidate.id}`);
    seenIds.add(candidate.id);
    if (candidate.findings.length) {
      for (const finding of candidate.findings)
        automaticWithheld.push({ code: finding.code, count: 1 });
      continue;
    }
    included.push(candidate);
  }

  const createdAt = isoNow(now);
  const expiresAt = new Date(
    now.getTime() + policy.review.approval_expires_minutes * 60_000,
  ).toISOString();
  const reportCore = {
    candidates: included,
    created_at: createdAt,
    expires_at: expiresAt,
    plugin_version: PLUGIN_VERSION,
    policy_digest: policyDigest(policy),
    policy_schema_version: policy.schema_version,
    report_id: id,
    source_refs: sourceRefs,
    withheld: mergeWithheld([
      ...safeWithheld(validated.withheld),
      ...automaticWithheld,
    ]),
  };
  const report = {
    ...reportCore,
    report_digest: sha256(canonicalize(reportCore)),
    status: "pending",
  };

  await atomicWrite(
    join(paths.reports, `${id}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (policy.review.persist_safe_reports) {
    await atomicWrite(
      join(paths.reports, `${id}.md`),
      renderReportMarkdown(report),
    );
  }
  await recordSourcesReviewed(paths, sourceRefs, id, now);
  return report;
}

export async function loadReport(pathsOrDir, reportId) {
  const paths =
    typeof pathsOrDir === "string" ? kindlingPaths(pathsOrDir) : pathsOrDir;
  if (!REPORT_ID_PATTERN.test(reportId))
    throw new Error("report ID is invalid");
  const report = JSON.parse(
    await readUtf8(join(paths.reports, `${reportId}.json`)),
  );
  const digest = report.report_digest;
  const { report_digest: ignored, status: ignoredStatus, ...core } = report;
  if (digest !== sha256(canonicalize(core))) {
    throw new Error(`report ${reportId} failed its integrity check`);
  }
  return report;
}

export function renderReportMarkdown(report) {
  const lines = [
    "# Kindling ingestion review",
    "",
    `- Report: \`${report.report_id}\``,
    `- Digest: \`${report.report_digest.slice(0, 12)}\``,
    `- Policy digest: \`${report.policy_digest.slice(0, 12)}\``,
    `- Created: ${report.created_at}`,
    `- Approval expires: ${report.expires_at}`,
    `- Candidates: ${report.candidates.length}`,
    "",
  ];
  for (const candidate of report.candidates) {
    lines.push(
      `## ${candidate.id}`,
      "",
      `**Title:** ${candidate.tool_input.title}`,
      "",
      `**Connector:** \`${candidate.tool_input.connector_label}\``,
      "",
      "**Exact content to send:**",
      "",
      "```markdown",
      candidate.tool_input.content,
      "```",
      "",
    );
    if (candidate.reason)
      lines.push(`**Why retained:** ${candidate.reason}`, "");
    if (candidate.removed.length) {
      lines.push(`**Removed:** ${candidate.removed.join(", ")}`, "");
    }
  }
  lines.push("## Withheld", "");
  if (!report.withheld.length)
    lines.push("No additional candidates were withheld.", "");
  for (const item of report.withheld)
    lines.push(`- ${item.code}: ${item.count}`);
  lines.push("", "## Approval", "");
  if (report.candidates.length) {
    lines.push(
      "Approve selected candidates with:",
      "",
      "```text",
      `APPROVE ${report.report_id} ${report.report_digest.slice(0, 12)} ${report.candidates
        .map((candidate) => candidate.id)
        .join(",")}`,
      "```",
      "",
    );
  } else {
    lines.push("Nothing is eligible for approval.", "");
  }
  lines.push(
    "Reject the report with:",
    "",
    "```text",
    `REJECT ${report.report_id} ${report.report_digest.slice(0, 12)}`,
    "```",
    "",
  );
  return `${lines.join("\n")}\n`;
}
