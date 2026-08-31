import { createHash, createHmac, randomBytes } from "node:crypto";

export function canonicalize(value) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("canonical JSON does not support non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  throw new TypeError(`unsupported canonical JSON value: ${typeof value}`);
}

export function sha256(value) {
  const bytes = typeof value === "string" ? value : canonicalize(value);
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

export function hmacSha256(secret, value) {
  return createHmac("sha256", secret)
    .update(String(value), "utf8")
    .digest("hex");
}

export function randomHex(bytes = 16) {
  return randomBytes(bytes).toString("hex");
}

export function normalizeToolInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Kindling tool input must be an object");
  }
  if (typeof input.content !== "string" || !input.content.trim()) {
    throw new TypeError("Kindling tool input requires non-empty content");
  }
  return {
    connector_label:
      input.connector_label === undefined || input.connector_label === null
        ? null
        : String(input.connector_label),
    content: input.content,
    origin_uri:
      input.origin_uri === undefined || input.origin_uri === null
        ? null
        : String(input.origin_uri),
    title:
      input.title === undefined || input.title === null
        ? null
        : String(input.title),
  };
}

export function toolInputDigest(input) {
  return sha256(normalizeToolInput(input));
}

export function isoNow(now = new Date()) {
  return now.toISOString();
}
