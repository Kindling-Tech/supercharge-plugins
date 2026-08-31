import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const plugin = resolve(root, "plugins/kindling-ingest");

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const codexManifest = await json(resolve(plugin, ".codex-plugin/plugin.json"));
const claudeManifest = await json(
  resolve(plugin, ".claude-plugin/plugin.json"),
);
const mcp = await json(resolve(plugin, ".mcp.json"));
const claudeMcp = await json(resolve(plugin, "claude.mcp.json"));
const hooks = await json(resolve(plugin, "hooks/hooks.json"));
const codexMarketplace = await json(
  resolve(root, ".agents/plugins/marketplace.json"),
);
const claudeMarketplace = await json(
  resolve(root, ".claude-plugin/marketplace.json"),
);
const cliPackage = await json(resolve(root, "packages/agent-cli/package.json"));
await json(resolve(plugin, "schemas/ingestion-policy.schema.json"));

assert(codexManifest.name === "kindling-ingest", "Codex plugin name mismatch");
assert(
  claudeManifest.name === "kindling-ingest",
  "Claude plugin name mismatch",
);
assert(
  codexManifest.version === claudeManifest.version,
  "plugin manifest versions differ",
);
assert(
  cliPackage.version === codexManifest.version,
  "CLI and plugin versions differ",
);
assert(
  codexManifest.mcpServers === "./.mcp.json",
  "Codex MCP path is not canonical",
);
assert(
  claudeManifest.mcpServers === "./claude.mcp.json",
  "Claude MCP path is not canonical",
);
assert(
  !("hooks" in claudeManifest),
  "Claude manifest must rely on default hook discovery",
);
assert(
  Object.keys(mcp.mcpServers).sort().join(",") === "granola,kindling",
  "MCP set mismatch",
);
assert(mcp.mcpServers.kindling.type === "http", "Kindling MCP must be HTTP");
assert(mcp.mcpServers.granola.type === "http", "Granola MCP must be HTTP");
assert(
  [...mcp.mcpServers.kindling.enabled_tools].sort().join(",") ===
    ["add_knowledge", "fetch_memory", "get_ingestion_status", "search_memory"]
      .sort()
      .join(","),
  "Codex Kindling tool allowlist mismatch",
);
assert(
  mcp.mcpServers.kindling.tools.add_knowledge.approval_mode === "prompt",
  "Codex add_knowledge must require approval",
);
assert(
  Object.keys(claudeMcp.mcpServers).sort().join(",") === "granola,kindling",
  "Claude MCP set mismatch",
);
assert(
  !("oauth_resource" in claudeMcp.mcpServers.kindling),
  "Claude MCP config contains Codex fields",
);
assert(Boolean(hooks.hooks.UserPromptSubmit), "UserPromptSubmit hook missing");
assert(Boolean(hooks.hooks.PreToolUse), "PreToolUse hook missing");
assert(Boolean(hooks.hooks.PostToolUse), "PostToolUse hook missing");
assert(
  Boolean(hooks.hooks.PostToolUseFailure),
  "PostToolUseFailure hook missing",
);
assert(
  codexMarketplace.plugins.some((entry) => entry.name === "kindling-ingest"),
  "Codex marketplace entry missing",
);
assert(
  claudeMarketplace.plugins.some((entry) => entry.name === "kindling-ingest"),
  "Claude marketplace entry missing",
);
assert(
  Object.keys(cliPackage.bin).length === 1,
  "CLI package must expose one binary",
);
assert(!cliPackage.scripts?.postinstall, "postinstall is forbidden");
assert(
  !cliPackage.dependencies || Object.keys(cliPackage.dependencies).length === 0,
  "published CLI must not install runtime dependencies",
);

const skillNames = ["kindling-mcp", "kindling-source-ingestion"];
for (const name of skillNames) {
  await stat(resolve(plugin, `skills/${name}/SKILL.md`));
  await stat(resolve(plugin, `skills/${name}/agents/openai.yaml`));
}

const allText = await Promise.all(
  [
    resolve(plugin, "skills/kindling-mcp/SKILL.md"),
    resolve(
      plugin,
      "skills/kindling-mcp/references/knowledge-tool-contract.md",
    ),
    resolve(plugin, "skills/kindling-source-ingestion/SKILL.md"),
  ].map((path) => readFile(path, "utf8")),
);
assert(
  !allText.join("\n").includes("list_memory_map"),
  "stale list_memory_map reference found",
);
await stat(resolve(plugin, "dist/kindling-guard.cjs"));
await stat(
  resolve(
    plugin,
    "skills/kindling-source-ingestion/scripts/kindling-ingest.cjs",
  ),
);

console.log("package validation passed");
