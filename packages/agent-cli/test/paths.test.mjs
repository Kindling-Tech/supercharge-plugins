import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findKindlingDir } from "../src/paths.mjs";

test("policy discovery does not escape the nearest repository root", async () => {
  const parent = await mkdtemp(join(tmpdir(), "kindling-paths-"));
  await mkdir(join(parent, ".kindling"));
  await writeFile(
    join(parent, ".kindling/ingestion-policy.yaml"),
    "schema_version: 1\n",
  );
  const repository = join(parent, "repo");
  const nested = join(repository, "src", "feature");
  await mkdir(join(repository, ".git"), { recursive: true });
  await mkdir(nested, { recursive: true });
  assert.equal(await findKindlingDir(nested), null);
});

test("explicit policy environment path must use the canonical filename", async () => {
  const previous = process.env.KINDLING_INGESTION_POLICY;
  process.env.KINDLING_INGESTION_POLICY = "/tmp/wrong-policy.yaml";
  try {
    await assert.rejects(
      () => findKindlingDir(process.cwd()),
      /ingestion-policy\.yaml/,
    );
  } finally {
    if (previous === undefined) delete process.env.KINDLING_INGESTION_POLICY;
    else process.env.KINDLING_INGESTION_POLICY = previous;
  }
});
