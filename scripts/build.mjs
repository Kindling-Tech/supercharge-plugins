import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { format } from "prettier";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const entry = resolve(root, "packages/agent-cli/src/cli.mjs");
const outputs = [
  {
    environment: "production",
    locked: false,
    path: resolve(root, "packages/agent-cli/dist/kindling-agent.cjs"),
  },
  {
    environment: "production",
    locked: true,
    path: resolve(root, "plugins/kindling/dist/kindling-guard.cjs"),
  },
  {
    environment: "production",
    locked: true,
    path: resolve(
      root,
      "plugins/kindling/skills/kindling-source-ingestion/scripts/kindling.cjs",
    ),
  },
  {
    environment: "staging",
    locked: true,
    path: resolve(
      root,
      "plugins/kindling-staging/dist/kindling-staging-guard.cjs",
    ),
  },
  {
    environment: "staging",
    locked: true,
    path: resolve(
      root,
      "plugins/kindling-staging/skills/kindling-staging-source-ingestion/scripts/kindling-staging.cjs",
    ),
  },
];

for (const output of outputs) {
  const outfile = output.path;
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
    define: {
      __KINDLING_BUILD_ENVIRONMENT__: JSON.stringify(output.environment),
      __KINDLING_BUILD_LOCKED__: JSON.stringify(output.locked),
    },
  });
  const bundled = await readFile(outfile, "utf8");
  const firstPass = await format(bundled, { filepath: outfile });
  await writeFile(
    outfile,
    await format(firstPass, { filepath: outfile }),
    "utf8",
  );
  await chmod(outfile, 0o755);
}
