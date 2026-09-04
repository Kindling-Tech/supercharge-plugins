import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const destination = await mkdtemp(join(tmpdir(), "kindling-npx-smoke-"));
const packageVersion = JSON.parse(
  await readFile(resolve(root, "packages/agent-cli/package.json"), "utf8"),
).version;

async function run(command, args, cwd = root) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise({ stderr, stdout });
      else
        reject(
          new Error(`${command} ${args.join(" ")} failed (${code}): ${stderr}`),
        );
    });
  });
}

try {
  await run("npm", [
    "pack",
    "--workspace",
    "@kindling/agent",
    "--pack-destination",
    destination,
  ]);
  const archive = (await readdir(destination)).find((name) =>
    name.endsWith(".tgz"),
  );
  if (!archive) throw new Error("npm pack did not create an archive");
  const result = await run("npx", [
    "--yes",
    "--offline",
    "--package",
    join(destination, archive),
    "kindling-agent",
    "version",
  ]);
  if (result.stdout.trim() !== packageVersion) {
    throw new Error(
      `unexpected npx version output: ${JSON.stringify(result.stdout)}`,
    );
  }
  console.log("npx package smoke test passed");
} finally {
  await rm(destination, { recursive: true, force: true });
}
