import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expectedTools = [
  "add_knowledge",
  "fetch_memory",
  "get_ingestion_status",
  "search_memory",
].sort();
const profiles = [
  {
    guard: "kindling-guard.cjs",
    id: "kindling",
    implicit: true,
    mcpUrl: "https://api.kindling.team/mcp",
    server: "kindling",
    skills: ["kindling-mcp", "kindling-source-ingestion"],
  },
  {
    guard: "kindling-staging-guard.cjs",
    id: "kindling-staging",
    implicit: false,
    mcpUrl: "https://api.staging.kindling.team/mcp",
    server: "kindling-staging",
    skills: ["kindling-staging-mcp", "kindling-staging-source-ingestion"],
  },
];

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const codexMarketplace = await json(
  resolve(root, ".agents/plugins/marketplace.json"),
);
const claudeMarketplace = await json(
  resolve(root, ".claude-plugin/marketplace.json"),
);
const cliPackage = await json(resolve(root, "packages/agent-cli/package.json"));

for (const profile of profiles) {
  const plugin = resolve(root, `plugins/${profile.id}`);
  const codexManifest = await json(
    resolve(plugin, ".codex-plugin/plugin.json"),
  );
  const claudeManifest = await json(
    resolve(plugin, ".claude-plugin/plugin.json"),
  );
  const mcp = await json(resolve(plugin, ".mcp.json"));
  const claudeMcp = await json(resolve(plugin, "claude.mcp.json"));
  const hooks = await json(resolve(plugin, "hooks/hooks.json"));
  const server = mcp.mcpServers[profile.server];
  const claudeServer = claudeMcp.mcpServers[profile.server];

  assert(
    codexManifest.name === profile.id,
    `${profile.id} Codex name mismatch`,
  );
  assert(
    claudeManifest.name === profile.id,
    `${profile.id} Claude name mismatch`,
  );
  assert(
    codexManifest.version === claudeManifest.version,
    `${profile.id} manifest versions differ`,
  );
  assert(
    cliPackage.version === codexManifest.version,
    `${profile.id} CLI and plugin versions differ`,
  );
  assert(
    codexManifest.mcpServers === "./.mcp.json",
    `${profile.id} Codex MCP path is not canonical`,
  );
  assert(
    claudeManifest.mcpServers === "./claude.mcp.json",
    `${profile.id} Claude MCP path is not canonical`,
  );
  assert(
    !("hooks" in claudeManifest),
    `${profile.id} Claude manifest must use default hook discovery`,
  );
  assert(
    Object.keys(mcp.mcpServers).join(",") === profile.server,
    `${profile.id} Codex MCP set mismatch`,
  );
  assert(server?.type === "http", `${profile.id} MCP must be HTTP`);
  assert(server.url === profile.mcpUrl, `${profile.id} MCP URL mismatch`);
  assert(
    server.oauth_resource === profile.mcpUrl,
    `${profile.id} OAuth resource mismatch`,
  );
  assert(
    [...server.enabled_tools].sort().join(",") === expectedTools.join(","),
    `${profile.id} tool allowlist mismatch`,
  );
  assert(
    server.tools.add_knowledge.approval_mode === "prompt",
    `${profile.id} add_knowledge must require approval`,
  );
  assert(
    Object.keys(claudeMcp.mcpServers).join(",") === profile.server,
    `${profile.id} Claude MCP set mismatch`,
  );
  assert(
    claudeServer?.url === profile.mcpUrl,
    `${profile.id} Claude MCP URL mismatch`,
  );
  assert(
    !("oauth_resource" in claudeServer),
    `${profile.id} Claude MCP config contains Codex fields`,
  );

  for (const hook of [
    "UserPromptSubmit",
    "SessionStart",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
  ]) {
    assert(Boolean(hooks.hooks[hook]), `${profile.id} ${hook} hook missing`);
  }
  assert(
    claudeManifest.userConfig?.auto_connect?.type === "boolean" &&
      claudeManifest.userConfig.auto_connect.default === true,
    `${profile.id} Claude automatic connection preference is invalid`,
  );
  const sessionStartHook = hooks.hooks.SessionStart[0]?.hooks?.[0];
  assert(
    sessionStartHook?.async === true &&
      sessionStartHook?.args?.join(" ") ===
        `\${CLAUDE_PLUGIN_ROOT}/dist/${profile.guard} connect --target claude-code --automatic`,
    `${profile.id} Claude startup connection hook is not canonical`,
  );
  const writeMatchers = ["PreToolUse", "PostToolUse", "PostToolUseFailure"].map(
    (name) => hooks.hooks[name][0]?.matcher,
  );
  if (profile.id === "kindling") {
    assert(
      writeMatchers.every((matcher) =>
        matcher.includes("?!.*kindling[-_]staging"),
      ),
      "production hooks must exclude Kindling Staging tools",
    );
  } else {
    assert(
      writeMatchers.every((matcher) => matcher.includes("kindling[-_]staging")),
      "staging hooks must match only Kindling Staging tools",
    );
  }

  const codexEntry = codexMarketplace.plugins.find(
    (entry) => entry.name === profile.id,
  );
  assert(Boolean(codexEntry), `${profile.id} Codex marketplace entry missing`);
  assert(
    codexEntry.source?.path === `./plugins/${profile.id}`,
    `${profile.id} Codex marketplace path mismatch`,
  );
  assert(
    codexEntry.policy?.installation === "AVAILABLE" &&
      codexEntry.policy?.authentication === "ON_INSTALL",
    `${profile.id} Codex marketplace policy mismatch`,
  );
  assert(
    claudeMarketplace.plugins.some((entry) => entry.name === profile.id),
    `${profile.id} Claude marketplace entry missing`,
  );

  for (const skill of profile.skills) {
    const skillRoot = resolve(plugin, `skills/${skill}`);
    await stat(resolve(skillRoot, "SKILL.md"));
    const metadata = YAML.parse(
      await readFile(resolve(skillRoot, "agents/openai.yaml"), "utf8"),
    );
    assert(
      metadata.dependencies?.tools?.length === 1 &&
        metadata.dependencies.tools[0]?.value === profile.server &&
        metadata.dependencies.tools[0]?.url === profile.mcpUrl,
      `${profile.id}/${skill} MCP dependency mismatch`,
    );
    assert(
      metadata.policy?.allow_implicit_invocation === profile.implicit,
      `${profile.id}/${skill} implicit invocation policy mismatch`,
    );
  }
  const publicContractText = await Promise.all([
    ...profile.skills.map((skill) =>
      readFile(resolve(plugin, `skills/${skill}/SKILL.md`), "utf8"),
    ),
    readFile(
      resolve(
        plugin,
        `skills/${profile.skills[0]}/references/knowledge-tool-contract.md`,
      ),
      "utf8",
    ),
  ]);
  assert(
    !publicContractText.join("\n").includes("list_memory_map"),
    `${profile.id} contains a stale list_memory_map reference`,
  );
  await json(resolve(plugin, "schemas/ingestion-policy.schema.json"));
  await stat(resolve(plugin, `dist/${profile.guard}`));
  await stat(
    resolve(plugin, `skills/${profile.skills[1]}/scripts/${profile.id}.cjs`),
  );
}

assert(Object.keys(cliPackage.bin).length === 1, "CLI must expose one binary");
assert(!cliPackage.scripts?.postinstall, "postinstall is forbidden");
assert(
  !cliPackage.dependencies || Object.keys(cliPackage.dependencies).length === 0,
  "published CLI must not install runtime dependencies",
);

console.log("package validation passed");
