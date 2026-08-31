import {
  access,
  appendFile,
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, dirname, join, parse, resolve } from "node:path";
import { randomHex } from "./canonical.mjs";

const POLICY_NAME = "ingestion-policy.yaml";
const LOCK_STALE_MS = 30_000;

export function kindlingPaths(kindlingDir) {
  const root = resolve(kindlingDir);
  return {
    root,
    policy: join(root, POLICY_NAME),
    reports: join(root, "reports"),
    state: join(root, "state"),
    approvals: join(root, "state", "approvals.jsonl"),
    sent: join(root, "state", "sent.jsonl"),
    failures: join(root, "state", "failures.jsonl"),
    sources: join(root, "state", "granola-sources.jsonl"),
    secret: join(root, "state", ".local-key"),
    lock: join(root, "state", ".ledger.lock"),
  };
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findKindlingDir(
  cwd = process.cwd(),
  { create = false } = {},
) {
  if (process.env.KINDLING_INGESTION_POLICY) {
    const explicitPolicy = resolve(process.env.KINDLING_INGESTION_POLICY);
    if (basename(explicitPolicy) !== POLICY_NAME) {
      throw new Error(`KINDLING_INGESTION_POLICY must point to ${POLICY_NAME}`);
    }
    return dirname(explicitPolicy);
  }

  let current = resolve(cwd);
  const filesystemRoot = parse(current).root;
  while (true) {
    const candidate = join(current, ".kindling");
    if (await exists(join(candidate, POLICY_NAME))) return candidate;
    if (await exists(join(current, ".git"))) break;
    if (current === filesystemRoot) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return create ? join(resolve(cwd), ".kindling") : null;
}

export async function ensurePrivateLayout(kindlingDir) {
  const paths = kindlingPaths(kindlingDir);
  await mkdir(paths.reports, { recursive: true, mode: 0o700 });
  await mkdir(paths.state, { recursive: true, mode: 0o700 });
  await chmod(paths.root, 0o700).catch(() => {});
  await chmod(paths.reports, 0o700).catch(() => {});
  await chmod(paths.state, 0o700).catch(() => {});
  const gitignore = join(paths.root, ".gitignore");
  if (!(await exists(gitignore))) {
    await atomicWrite(gitignore, "reports/\nstate/\n", 0o600);
  }
  if (!(await exists(paths.secret))) {
    await atomicWrite(paths.secret, `${randomHex(32)}\n`, 0o600);
  }
  return paths;
}

export async function atomicWrite(path, contents, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp-${process.pid}-${randomHex(4)}`;
  const handle = await open(temporary, "wx", mode);
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(temporary, mode).catch(() => {});
  await rename(temporary, path);
}

function wait(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

async function acquireLock(lockPath) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(`${process.pid} ${Date.now()}\n`, "utf8");
      return async () => {
        await handle.close().catch(() => {});
        await unlink(lockPath).catch(() => {});
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > LOCK_STALE_MS) {
          await unlink(lockPath);
          continue;
        }
      } catch (statError) {
        if (statError?.code !== "ENOENT") throw statError;
      }
      await wait(25);
    }
  }
  throw new Error("timed out waiting for the Kindling ingestion state lock");
}

export async function appendLedger(paths, path, entry) {
  const release = await acquireLock(paths.lock);
  try {
    await appendFile(path, `${JSON.stringify(entry)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(path, 0o600).catch(() => {});
  } finally {
    await release();
  }
}

export async function readLedger(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const entries = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("ledger entry is not an object");
      }
      entries.push(parsed);
    } catch (error) {
      throw new Error(
        `invalid ledger entry at line ${index + 1}: ${error.message}`,
      );
    }
  }
  return entries;
}

export async function readUtf8(path) {
  return readFile(path, "utf8");
}

export async function writeUtf8(path, value, mode = 0o600) {
  return atomicWrite(path, value, mode);
}

export async function pathExists(path) {
  return exists(path);
}
