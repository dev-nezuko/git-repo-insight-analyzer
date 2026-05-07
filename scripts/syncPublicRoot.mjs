#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
// WEB_DIST_OUT must match vercel.json outputDirectory (default here: deploy-static).
const staticOut = process.env.WEB_DIST_OUT ?? "deploy-static";
const src = path.join(repoRoot, "client", "dist");
const dest = path.join(repoRoot, staticOut);
const marker = path.join(src, "index.html");

if (!fs.existsSync(marker)) {
  console.error("syncPublicRoot: missing client/dist/index.html after client build");
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
