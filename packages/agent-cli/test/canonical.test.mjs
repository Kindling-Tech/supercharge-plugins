import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalize, sha256, toolInputDigest } from "../src/canonical.mjs";
import { sourceContentDigest } from "../src/sources.mjs";

test("canonical JSON sorts object keys recursively", () => {
  const left = { z: 1, a: { y: 2, b: 3 } };
  const right = { a: { b: 3, y: 2 }, z: 1 };
  assert.equal(canonicalize(left), canonicalize(right));
  assert.equal(sha256(left), sha256(right));
});

test("tool digest includes every writable field", () => {
  const base = {
    connector_label: "connected-source-reviewed",
    content: "Safe content",
    origin_uri: null,
    title: "Title",
  };
  const digest = toolInputDigest(base);
  for (const [key, value] of [
    ["connector_label", "manual-reviewed"],
    ["content", "Changed"],
    ["origin_uri", "https://example.com"],
    ["title", "Changed title"],
    ["founder_id", "11111111-1111-1111-1111-111111111111"],
  ]) {
    assert.notEqual(toolInputDigest({ ...base, [key]: value }), digest);
  }
});

test("Profile destination is exact and company digests remain compatible", () => {
  const company = { content: "Safe voice preference" };
  const profile = {
    ...company,
    founder_id: "11111111-1111-1111-1111-111111111111",
  };
  assert.equal(
    toolInputDigest(company),
    toolInputDigest({ ...company, founder_id: null }),
  );
  assert.notEqual(toolInputDigest(company), toolInputDigest(profile));
  assert.notEqual(
    toolInputDigest(profile),
    toolInputDigest({
      ...profile,
      founder_id: "22222222-2222-2222-2222-222222222222",
    }),
  );
  assert.throws(
    () => toolInputDigest({ ...company, founder_id: "My Profile" }),
    /Profile UUID/,
  );
  assert.throws(
    () => toolInputDigest({ ...company, company_id: "other" }),
    /Unknown Kindling tool argument/,
  );
});

test("source content digest normalizes CRLF only", () => {
  assert.equal(
    sourceContentDigest("one\r\ntwo"),
    sourceContentDigest("one\ntwo"),
  );
  assert.notEqual(
    sourceContentDigest("one two"),
    sourceContentDigest("one\ntwo"),
  );
});
