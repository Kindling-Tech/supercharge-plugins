import {
  appendLedger,
  ensurePrivateLayout,
  findKindlingDir,
  kindlingPaths,
} from "./paths.mjs";
import { isoNow, toolInputDigest } from "./canonical.mjs";
import {
  consumeApproval,
  findActiveApproval,
  parseApprovalPrompt,
  recordApproval,
} from "./approval.mjs";
import { loadReport } from "./report.mjs";
import { recordSourcesSent } from "./sources.mjs";
import { loadPolicy, policyDigest } from "./policy.mjs";

const INGESTION_INTENT =
  /\b(?:ingest|save (?:this|that)|remember (?:this|that)|granola|meeting notes?|knowledge base|add (?:this|that) to (?:kindling|memory))\b/i;

function promptContext(message) {
  return {
    hookSpecificOutput: {
      additionalContext: message,
      hookEventName: "UserPromptSubmit",
    },
  };
}

function denyWrite(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

function isKindlingAddKnowledge(toolName) {
  const value = String(toolName ?? "").toLowerCase();
  return (
    value.startsWith("mcp__") &&
    value.includes("kindling") &&
    value.endsWith("__add_knowledge")
  );
}

async function resolvePaths(payload, { create = false } = {}) {
  const kindlingDir = await findKindlingDir(payload.cwd ?? process.cwd(), {
    create,
  });
  if (!kindlingDir) return null;
  return create ? ensurePrivateLayout(kindlingDir) : kindlingPaths(kindlingDir);
}

export async function handleUserPrompt(payload, now = new Date()) {
  const prompt = String(
    payload.prompt ?? payload.user_prompt ?? payload.userPrompt ?? "",
  ).trim();
  const parsed = parseApprovalPrompt(prompt);
  if (parsed) {
    try {
      const paths = await resolvePaths(payload);
      if (!paths)
        throw new Error("no .kindling/ingestion-policy.yaml was found");
      const result = await recordApproval(paths, parsed, {
        now,
        sessionId: payload.session_id ?? null,
      });
      if (result.rejected) {
        return promptContext(
          `Kindling ingestion report ${result.report.report_id} was rejected. Do not call add_knowledge for any candidate from it.`,
        );
      }
      return promptContext(
        `Explicit Kindling ingestion approval was recorded for ${result.selected
          .map((candidate) => candidate.id)
          .join(
            ", ",
          )} from report ${result.report.report_id}. Call add_knowledge only with each candidate's exact reviewed arguments.`,
      );
    } catch (error) {
      return promptContext(
        `Kindling ingestion approval was not recorded: ${error.message}`,
      );
    }
  }
  if (INGESTION_INTENT.test(prompt)) {
    return promptContext(
      "Use the installed kindling-source-ingestion skill. Generate a digest-bound review report and wait for explicit approval before calling Kindling add_knowledge.",
    );
  }
  return null;
}

export async function handleBeforeWrite(payload, now = new Date()) {
  if (!isKindlingAddKnowledge(payload.tool_name)) return null;
  try {
    const paths = await resolvePaths(payload);
    if (!paths) {
      return denyWrite(
        "Kindling ingestion blocked: no .kindling/ingestion-policy.yaml was found. Run the cold-start workflow first.",
      );
    }
    const digest = toolInputDigest(payload.tool_input);
    const approval = await findActiveApproval(paths, digest, {
      now,
      sessionId: payload.session_id ?? null,
    });
    if (!approval) {
      return denyWrite(
        "Kindling ingestion blocked: the exact add_knowledge arguments do not have an active user-approved review receipt.",
      );
    }
    const currentPolicy = await loadPolicy(paths.policy);
    if (policyDigest(currentPolicy) !== approval.policy_digest) {
      return denyWrite(
        "Kindling ingestion blocked: the customer policy changed after approval. Create and approve a new report.",
      );
    }
    return null;
  } catch (error) {
    return denyWrite(
      `Kindling ingestion blocked because local approval state could not be verified: ${error.message}`,
    );
  }
}

function deepFind(value, key) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return deepFind(JSON.parse(value), key);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFind(item, key);
      if (found !== null && found !== undefined) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
    for (const item of Object.values(value)) {
      const found = deepFind(item, key);
      if (found !== null && found !== undefined) return found;
    }
  }
  return null;
}

export async function handleAfterWrite(payload, now = new Date()) {
  if (!isKindlingAddKnowledge(payload.tool_name)) return null;
  const paths = await resolvePaths(payload);
  if (!paths) return null;
  const digest = toolInputDigest(payload.tool_input);
  const approval = await findActiveApproval(paths, digest, {
    now,
    sessionId: payload.session_id ?? null,
  });
  if (!approval) return null;

  const sourceId = deepFind(payload.tool_response, "source_id");
  const status = deepFind(payload.tool_response, "status");
  await consumeApproval(paths, approval, now);
  await appendLedger(paths, paths.sent, {
    approval_id: approval.approval_id,
    candidate_id: approval.candidate_id,
    report_digest: approval.report_digest,
    report_id: approval.report_id,
    sent_at: isoNow(now),
    source_id: sourceId === null ? null : String(sourceId).slice(0, 200),
    status: status === null ? null : String(status).slice(0, 100),
    tool_input_digest: digest,
    type: "knowledge_sent",
  });
  const report = await loadReport(paths, approval.report_id);
  await recordSourcesSent(
    paths,
    report.source_refs,
    approval.report_id,
    approval.candidate_id,
    now,
  );
  return null;
}

export async function handleWriteFailure(payload, now = new Date()) {
  if (!isKindlingAddKnowledge(payload.tool_name)) return null;
  const paths = await resolvePaths(payload);
  if (!paths) return null;
  let digest = null;
  try {
    digest = toolInputDigest(payload.tool_input);
  } catch {
    // A malformed tool input is logged without copying it.
  }
  await appendLedger(paths, paths.failures, {
    failed_at: isoNow(now),
    response_kind: Array.isArray(payload.tool_response)
      ? "array"
      : typeof payload.tool_response,
    tool_input_digest: digest,
    tool_name: String(payload.tool_name).slice(0, 200),
    type: "knowledge_send_failed",
  });
  return null;
}

export async function runHook(mode, payload, now = new Date()) {
  if (mode === "prompt") return handleUserPrompt(payload, now);
  if (mode === "before-write") return handleBeforeWrite(payload, now);
  if (mode === "after-write") return handleAfterWrite(payload, now);
  if (mode === "write-failed") return handleWriteFailure(payload, now);
  throw new Error(`unknown hook mode: ${mode}`);
}
