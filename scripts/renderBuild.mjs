#!/usr/bin/env node
/**
 * Render (and any host) build entry: compiles server + client; skips Vercel-only deploy-static sync.
 * Invoked as: node scripts/renderBuild.mjs
 * Does not rely on shell "VAR=1 cmd" so it works the same on all platforms.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const vercelBuild = path.join(repoRoot, "scripts", "vercelBuild.mjs");

const r = spawnSync(process.execPath, [vercelBuild], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, SKIP_WEB_SYNC: "1" },
});

process.exit(typeof r.status === "number" ? r.status : 1);
