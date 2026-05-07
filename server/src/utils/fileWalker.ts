import fs from "node:fs/promises";
import path from "node:path";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "coverage"]);
/** Only skip obvious junk; manifests (package.json, lockfiles, nested package.json) stay indexed. */
const SKIP_FILES = new Set([".ds_store"]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".cs",
  ".php",
  ".rb",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".sql",
  ".css",
  ".scss",
  ".html",
  ".graphql",
  ".gql",
  ".sh",
  ".bash",
  ".zsh",
  ".svg",
  ".txt"
]);

/** Dotfiles have no real extension for path.extname — allow by basename. */
const DOTFILES_ALLOW = new Set([
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".prettierrc",
  ".prettierignore",
  ".eslintrc",
  ".eslintignore",
  ".env",
  ".env.example",
  ".env.local",
  ".npmrc",
  ".nvmrc",
  ".node-version",
  ".browserslistrc",
  ".dockerignore"
]);

/** Basenames without extension we still ingest (lowercased). */
const EXTENSIONLESS_ALLOW = new Set([
  "dockerfile",
  "makefile",
  "license",
  "contributing",
  "codeowners",
  "jenkinsfile",
  "gemfile",
  "rakefile",
  "procfile",
  "vagrantfile"
]);

function isAllowedFile(entryName: string): boolean {
  const base = entryName.toLowerCase();
  if (SKIP_FILES.has(base)) {
    return false;
  }
  if (DOTFILES_ALLOW.has(base)) {
    return true;
  }
  // All JSON: root + workspace package.json, tsconfig.*.json, angular.json, etc.
  if (base.endsWith(".json")) {
    return true;
  }
  if (base === "yarn.lock" || base === "pnpm-lock.yaml" || base === "bun.lock") {
    return true;
  }
  const ext = path.extname(entryName).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }
  if (EXTENSIONLESS_ALLOW.has(base)) {
    return true;
  }
  if (/^dockerfile/i.test(entryName)) {
    return true;
  }
  return false;
}

export interface RepoFile {
  absolutePath: string;
  relativePath: string;
  content: string;
}

async function walkDir(baseDir: string, currentDir: string, files: RepoFile[]): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(baseDir, absolutePath);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      await walkDir(baseDir, absolutePath, files);
      continue;
    }

    if (!isAllowedFile(entry.name)) {
      continue;
    }

    const content = await fs.readFile(absolutePath, "utf8");
    files.push({ absolutePath, relativePath, content });
  }
}

export async function collectTextFiles(baseDir: string): Promise<RepoFile[]> {
  const files: RepoFile[] = [];
  await walkDir(baseDir, baseDir, files);
  return files;
}
