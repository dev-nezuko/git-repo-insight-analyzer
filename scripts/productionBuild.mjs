#!/usr/bin/env node
/**
 * Production build: TypeScript server → `server/dist`, Vite client → `client/dist`
 * for a unified Node server (Render, Docker, VPS). No static export/sync step.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { chdir, cwd as processCwd } from "node:process";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

/** @param {string} msg @param {string} [detail] */
function panic(msg, detail) {
  console.error(`[productionBuild] FAILED: ${msg}`);
  if (detail) console.error(String(detail));
  process.exit(1);
}

/** @param {string} step */
function log(step) {
  console.error(`[productionBuild] ${step}`);
}

function withBinsOnPath(extraBindirs) {
  const prefix = [...extraBindirs, process.env.PATH ?? ""].filter(Boolean).join(path.delimiter);
  return { ...process.env, PATH: prefix };
}

/**
 * Locate a tool file in the workspace that declares the package, falling back to the
 * hoisted root copy. Root-first lookup picked the wrong major when workspaces disagree
 * (vitest's Vite 6 is hoisted to the root while the client declares Vite 8).
 * @param {"server" | "client"} workspace
 * @param {string} pkg
 * @param {...string} segments
 */
function locateTool(workspace, pkg, ...segments) {
  for (const base of [path.join(repoRoot, workspace), repoRoot]) {
    const file = path.join(base, "node_modules", pkg, ...segments);
    if (existsSync(file)) return file;
  }
  return null;
}

/** Run `node <resolvedJs> ...args` (must use execFileSync — execSync does not accept argv arrays). */
function runNodeJsTool(resolvedJs, args, runOpts) {
  execFileSync(process.execPath, [resolvedJs, ...args], runOpts);
}

try {
  log(`cwd(before)=${processCwd()}`);
  log(`repoRoot=${repoRoot}`);
  chdir(repoRoot);
  log(`cwd(after)=${processCwd()}`);

  if (!existsSync(path.join(repoRoot, "server", "package.json"))) {
    panic("missing server/package.json", repoRoot);
  }
  if (!existsSync(path.join(repoRoot, "client", "package.json"))) {
    panic("missing client/package.json", repoRoot);
  }

  const bins = [
    path.join(repoRoot, "node_modules", ".bin"),
    path.join(repoRoot, "server", "node_modules", ".bin"),
    path.join(repoRoot, "client", "node_modules", ".bin"),
  ].filter((d) => existsSync(d));

  const pathEnv = withBinsOnPath(bins);

  const tsConfig = path.join(repoRoot, "server", "tsconfig.build.json");
  if (!existsSync(tsConfig)) {
    panic(`missing ${tsConfig}`);
  }

  log("▶ typescript (server)");
  const tscJs = locateTool("server", "typescript", "lib", "tsc.js");
  if (tscJs) {
    runNodeJsTool(tscJs, ["-p", tsConfig], {
      cwd: repoRoot,
      stdio: "inherit",
      env: pathEnv,
    });
  } else {
    log("(tsc fallback: npx --no-install)");
    execSync("npx --no-install tsc -p server/tsconfig.build.json", {
      cwd: repoRoot,
      stdio: "inherit",
      shell: "/bin/sh",
      env: pathEnv,
    });
  }

  const clientDir = path.resolve(repoRoot, "client");
  const entryHtml = path.join(clientDir, "index.html");
  if (!existsSync(entryHtml)) {
    panic("missing client/index.html — Vite needs it at the package root", entryHtml);
  }

  log("▶ vite (client)");
  /** Vite 6+ root is positional; see `vite build --help`. */
  const viteArgs = ["build", "--config", "vite.config.ts", "--outDir", "dist", "."];

  const viteJs = locateTool("client", "vite", "bin", "vite.js");
  if (viteJs) {
    runNodeJsTool(viteJs, viteArgs, { cwd: clientDir, stdio: "inherit", env: pathEnv });
  } else {
    log("(vite fallback: npx --no-install)");
    execFileSync("npx", ["--no-install", "vite", ...viteArgs], {
      cwd: clientDir,
      stdio: "inherit",
      env: pathEnv,
    });
  }

  const distIndex = path.join(repoRoot, "client", "dist", "index.html");
  if (!existsSync(distIndex)) {
    panic("vite did not produce client/dist/index.html", `(checked ${distIndex})`);
  }

  log("done");
} catch (error) {
  panic(error?.message ?? String(error), error?.stack ?? "");
}
