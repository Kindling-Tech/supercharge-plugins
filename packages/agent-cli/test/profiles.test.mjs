import assert from "node:assert/strict";
import { test } from "node:test";
import { targetToolInputDigest } from "../src/canonical.mjs";
import { kindlingPaths } from "../src/paths.mjs";
import {
  getEnvironmentProfile,
  isReportIdForProfile,
  reportTargetMatchesProfile,
} from "../src/profiles.mjs";

test("production and staging profiles isolate servers, state, and approvals", () => {
  const production = getEnvironmentProfile("production");
  const staging = getEnvironmentProfile("staging");
  const input = { content: "Safe durable knowledge" };
  const productionPaths = kindlingPaths("/tmp/kindling", production);
  const stagingPaths = kindlingPaths("/tmp/kindling", staging);

  assert.notEqual(production.mcpUrl, staging.mcpUrl);
  assert.notEqual(production.codexServer, staging.codexServer);
  assert.notEqual(productionPaths.approvals, stagingPaths.approvals);
  assert.notEqual(
    targetToolInputDigest(input, production),
    targetToolInputDigest(input, staging),
  );
});

test("report IDs and report targets are environment specific", () => {
  const production = getEnvironmentProfile("production");
  const staging = getEnvironmentProfile("staging");
  const stagingReport = {
    target_environment: staging.environment,
    target_mcp_resource: staging.mcpUrl,
    target_plugin: staging.pluginId,
  };

  assert.equal(
    isReportIdForProfile("KIR-20260904-120000-ab12", production),
    true,
  );
  assert.equal(
    isReportIdForProfile("KISR-20260904-120000-ab12", staging),
    true,
  );
  assert.equal(
    isReportIdForProfile("KISR-20260904-120000-ab12", production),
    false,
  );
  assert.equal(reportTargetMatchesProfile(stagingReport, staging), true);
  assert.equal(reportTargetMatchesProfile(stagingReport, production), false);
});
