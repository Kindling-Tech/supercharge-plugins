import { readUtf8, appendLedger, readLedger } from "./paths.mjs";
import { hmacSha256, isoNow, sha256 } from "./canonical.mjs";

export async function localSourceKey(paths, externalId) {
  const secret = (await readUtf8(paths.secret)).trim();
  if (!secret) throw new Error("Kindling local state key is empty");
  return hmacSha256(secret, externalId);
}

export function sourceContentDigest(content) {
  return sha256(String(content).replace(/\r\n/g, "\n"));
}

export async function sourceStatus(paths, { externalId, content }) {
  return sourceStatusFromDigest(paths, {
    contentDigest: sourceContentDigest(content),
    externalId,
  });
}

export async function sourceStatusFromDigest(
  paths,
  { externalId, contentDigest },
) {
  if (!externalId) throw new Error("source external ID is required");
  if (!/^[a-f0-9]{64}$/.test(String(contentDigest))) {
    throw new Error(
      "source content digest must be 64 lowercase SHA-256 characters",
    );
  }
  const sourceKey = await localSourceKey(paths, externalId);
  const events = await readLedger(paths.sources);
  const previous = [...events]
    .reverse()
    .find(
      (event) =>
        event.source_key === sourceKey && event.type === "source_reviewed",
    );
  return {
    content_digest: String(contentDigest),
    source_key: sourceKey,
    status: previous
      ? previous.content_digest === String(contentDigest)
        ? "unchanged"
        : "changed"
      : "new",
  };
}

export async function recordSourcesReviewed(
  paths,
  sourceRefs,
  reportId,
  now = new Date(),
) {
  for (const source of sourceRefs) {
    await appendLedger(paths, paths.sources, {
      content_digest: source.content_digest,
      observed_at: source.observed_at ?? null,
      provider: source.provider,
      report_id: reportId,
      reviewed_at: isoNow(now),
      source_key: source.source_key,
      type: "source_reviewed",
    });
  }
}

export async function recordSourcesSent(
  paths,
  sourceRefs,
  reportId,
  candidateId,
  now = new Date(),
) {
  for (const source of sourceRefs) {
    await appendLedger(paths, paths.sources, {
      candidate_id: candidateId,
      content_digest: source.content_digest,
      provider: source.provider,
      report_id: reportId,
      sent_at: isoNow(now),
      source_key: source.source_key,
      type: "source_sent",
    });
  }
}
