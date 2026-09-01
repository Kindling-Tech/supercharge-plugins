import { mkdir, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const entry = resolve(root, "packages/agent-cli/src/cli.mjs");
const outputs = [
  resolve(root, "packages/agent-cli/dist/kindling-agent.cjs"),
  resolve(root, "plugins/kindling/dist/kindling-guard.cjs"),
  resolve(
    root,
    "plugins/kindling/skills/kindling-source-ingestion/scripts/kindling.cjs",
  ),
];

for (const outfile of outputs) {
  await mkdir(resolve(outfile, ".."), { recursive: true });
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    banner: { js: "#!/usr/bin/env node" },
    sourcemap: false,
    legalComments: "none",
  });
  await chmod(outfile, 0o755);
}
