#!/usr/bin/env node
/**
 * When Vercel "Root Directory" is `server`, the dashboard runs
 * `node scripts/vercelBuild.mjs` relative to that folder — this file forwards
 * to the real orchestrator at the repository root.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const script = path.join(repoRoot, "scripts", "vercelBuild.mjs");

const r = spawnSync(process.execPath, [script], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(typeof r.status === "number" ? r.status : 1);
