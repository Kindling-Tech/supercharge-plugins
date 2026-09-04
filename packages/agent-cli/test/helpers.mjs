import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultPolicy, renderPolicy } from "../src/policy.mjs";
import { ensurePrivateLayout } from "../src/paths.mjs";
import { sourceContentDigest } from "../src/sources.mjs";

export const SAFE_SOURCE_TEXT = "A source about stable public positioning.";

export async function temporaryWorkspace(prefix = "kindling-test-") {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const kindlingDir = join(root, ".kindling");
  const paths = await ensurePrivateLayout(kindlingDir);
  const policy = defaultPolicy();
  await writeFile(paths.policy, renderPolicy(policy), {
    encoding: "utf8",
    mode: 0o600,
  });
  return { kindlingDir, paths, policy, root };
}

export function safeReportInput(overrides = {}) {
  return {
    source: {
      provider: "connected-source",
      items: [
        {
          content_digest: sourceContentDigest(SAFE_SOURCE_TEXT),
          external_id: "record-123",
          observed_at: "2026-08-31T09:00:00Z",
        },
      ],
    },
    candidates: [
      {
        content:
          "Enterprise buyers value a concrete implementation timeline before advanced evaluation.",
        id: "KI-001",
        reason: "Durable generalized buying-process signal.",
        removed: ["participant_names", "customer_name"],
        title: "Enterprise onboarding expectations",
      },
    ],
    withheld: [{ code: "meeting_logistics", count: 2 }],
    ...overrides,
  };
}

export async function fileText(path) {
  return readFile(path, "utf8");
}
