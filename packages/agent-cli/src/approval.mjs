import { isoNow } from "./canonical.mjs";
import { appendLedger, readLedger } from "./paths.mjs";
import { loadReport } from "./report.mjs";
import { loadPolicy, policyDigest } from "./policy.mjs";
import {
  getEnvironmentProfile,
  reportTargetMatchesProfile,
} from "./profiles.mjs";

export function parseApprovalPrompt(prompt) {
  const profile = getEnvironmentProfile();
  const reportPattern = `${profile.reportPrefix}-\\d{8}-\\d{6}-[a-f0-9]{4}`;
  const approvePattern = new RegExp(
    `^APPROVE\\s+(${reportPattern})\\s+([a-f0-9]{12,64})\\s+(.+)$`,
    "i",
  );
  const rejectPattern = new RegExp(
    `^REJECT\\s+(${reportPattern})\\s+([a-f0-9]{12,64})$`,
    "i",
  );
  const value = String(prompt ?? "").trim();
  const approve = value.match(approvePattern);
  if (approve) {
    const rawSelection = approve[3].trim();
    const candidateIds =
      rawSelection.toUpperCase() === "ALL"
        ? "ALL"
        : [
            ...new Set(
              rawSelection
                .split(/[\s,]+/)
                .filter(Boolean)
                .map((id) => id.toUpperCase()),
            ),
          ];
    return {
      candidate_ids: candidateIds,
      digest_prefix: approve[2].toLowerCase(),
      report_id: normalizeReportId(approve[1]),
      type: "approve",
    };
  }
  const reject = value.match(rejectPattern);
  if (reject) {
    return {
      digest_prefix: reject[2].toLowerCase(),
      report_id: normalizeReportId(reject[1]),
      type: "reject",
    };
  }
  return null;
}

function approvalId(reportId, candidateId, toolInputDigest) {
  return `${reportId}:${candidateId}:${toolInputDigest.slice(0, 16)}`;
}

function normalizeReportId(value) {
  const profile = getEnvironmentProfile();
  return `${profile.reportPrefix}-${String(value)
    .slice(profile.reportPrefix.length + 1)
    .toLowerCase()}`;
}

export async function recordApproval(
  paths,
  parsed,
  { sessionId = null, now = new Date() } = {},
) {
  const report = await loadReport(paths, parsed.report_id);
  const profile = getEnvironmentProfile();
  if (!reportTargetMatchesProfile(report, profile)) {
    throw new Error("the report targets a different Kindling environment");
  }
  const policy = await loadPolicy(paths.policy);
  if (policyDigest(policy) !== report.policy_digest) {
    throw new Error(
      "the customer policy changed after this report was created; create a new report",
    );
  }
  if (!report.report_digest.startsWith(parsed.digest_prefix)) {
    throw new Error("approval digest does not match the report");
  }
  if (new Date(report.expires_at).getTime() <= now.getTime()) {
    throw new Error("the report has expired; create a new report");
  }
  if (parsed.type === "reject") {
    await appendLedger(paths, paths.approvals, {
      rejected_at: isoNow(now),
      report_digest: report.report_digest,
      report_id: report.report_id,
      session_id: sessionId,
      type: "report_rejected",
    });
    return { report, rejected: true, selected: [] };
  }

  const existingEvents = await readLedger(paths.approvals);
  if (
    existingEvents.some(
      (event) =>
        event.type === "report_rejected" &&
        event.report_id === report.report_id,
    )
  ) {
    throw new Error("the report was already rejected; create a new report");
  }
  if (parsed.candidate_ids === "ALL" && !policy.review.allow_approve_all) {
    throw new Error("the customer policy does not permit approve-all");
  }

  const available = new Map(
    report.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const selectedIds =
    parsed.candidate_ids === "ALL"
      ? [...available.keys()]
      : parsed.candidate_ids;
  if (!selectedIds.length)
    throw new Error("approval must select at least one candidate");
  const selected = [];
  for (const id of selectedIds) {
    const candidate = available.get(id);
    if (!candidate)
      throw new Error(`candidate ${id} is not in report ${report.report_id}`);
    selected.push(candidate);
  }

  for (const candidate of selected) {
    await appendLedger(paths, paths.approvals, {
      approval_id: approvalId(
        report.report_id,
        candidate.id,
        candidate.tool_input_digest,
      ),
      approved_at: isoNow(now),
      candidate_id: candidate.id,
      expires_at: report.expires_at,
      report_digest: report.report_digest,
      report_id: report.report_id,
      policy_digest: report.policy_digest,
      target_environment: profile.environment,
      target_mcp_resource: profile.mcpUrl,
      target_plugin: profile.pluginId,
      session_id: sessionId,
      tool_input_digest: candidate.tool_input_digest,
      type: "candidate_approved",
    });
  }
  return { report, rejected: false, selected };
}

function foldApprovalEvents(events) {
  const approvals = new Map();
  const rejectedReports = new Set();
  for (const event of events) {
    if (event.type === "candidate_approved" && event.approval_id) {
      approvals.set(event.approval_id, { ...event, consumed: false });
    } else if (
      event.type === "approval_consumed" &&
      approvals.has(event.approval_id)
    ) {
      approvals.get(event.approval_id).consumed = true;
      approvals.get(event.approval_id).consumed_at = event.consumed_at;
    } else if (event.type === "report_rejected") {
      rejectedReports.add(event.report_id);
    }
  }
  return { approvals, rejectedReports };
}

export async function findActiveApproval(
  paths,
  toolInputDigest,
  { sessionId = null, now = new Date() } = {},
) {
  const profile = getEnvironmentProfile();
  const events = await readLedger(paths.approvals);
  const { approvals, rejectedReports } = foldApprovalEvents(events);
  return (
    [...approvals.values()].find(
      (approval) =>
        approval.tool_input_digest === toolInputDigest &&
        (approval.target_environment ?? "production") === profile.environment &&
        (approval.target_mcp_resource ??
          getEnvironmentProfile("production").mcpUrl) === profile.mcpUrl &&
        (approval.target_plugin ??
          getEnvironmentProfile("production").pluginId) === profile.pluginId &&
        !approval.consumed &&
        !rejectedReports.has(approval.report_id) &&
        new Date(approval.expires_at).getTime() > now.getTime() &&
        (!approval.session_id ||
          !sessionId ||
          approval.session_id === sessionId),
    ) ?? null
  );
}

export async function consumeApproval(paths, approval, now = new Date()) {
  await appendLedger(paths, paths.approvals, {
    approval_id: approval.approval_id,
    consumed_at: isoNow(now),
    type: "approval_consumed",
  });
}
