#!/usr/bin/env node
/**
 * Production build: TypeScript server → `server/dist`, Vite client → `client/dist`
 * for a unified Node server (Render, Docker, VPS). No static export/sync step.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
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
 * Resolve a concrete file inside an installed package (works with npm hoisting).
 * @param {string} specifier e.g. "typescript/lib/tsc.js"
 */
function resolvePackageEntry(specifier) {
  /** @type {string[]} */
  const hosts = [
    path.join(repoRoot, "package.json"),
    path.join(repoRoot, "server", "package.json"),
    path.join(repoRoot, "client", "package.json"),
  ];
  for (const pj of hosts) {
    if (!existsSync(pj)) continue;
    try {
      const req = createRequire(pj);
      const resolved = req.resolve(specifier);
      if (resolved && existsSync(resolved)) return resolved;
    } catch {
      /* try next host */
    }
  }
  return null;
}

/**
 * Locate `node_modules/pkg/...segments` (flat hoist layout typical of npm workspaces).
 */
function lookupHoistedFile(pkg, ...segments) {
  const tries = [
    path.join(repoRoot, "node_modules", pkg, ...segments),
    path.join(repoRoot, "server", "node_modules", pkg, ...segments),
    path.join(repoRoot, "client", "node_modules", pkg, ...segments),
  ];
  const hit = tries.find(existsSync) ?? null;
  return { hit, tries };
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
  const tscJs =
    resolvePackageEntry("typescript/lib/tsc.js") ?? lookupHoistedFile("typescript", "lib", "tsc.js").hit;
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

  const viteJs = resolvePackageEntry("vite/bin/vite.js") ?? lookupHoistedFile("vite", "bin", "vite.js").hit;
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
