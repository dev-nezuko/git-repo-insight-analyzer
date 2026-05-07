import path from "node:path";

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "coverage"]);
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

/** Dotfiles have no real extension for path.extname, so they are allowed by basename. */
const DOTFILES_ALLOW = new Set([
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".prettierrc",
  ".prettierignore",
  ".eslintrc",
  ".eslintignore",
  ".env.example",
  ".nvmrc",
  ".node-version",
  ".browserslistrc",
  ".dockerignore"
]);

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

export function isAllowedFileName(fileName: string): boolean {
  const base = fileName.toLowerCase();
  // Live env files and npm credentials can hold secrets; the example file is documentation.
  if ((base === ".env" || base.startsWith(".env.")) && base !== ".env.example") return false;
  if (base === ".npmrc" || SKIP_FILES.has(base)) return false;
  if (DOTFILES_ALLOW.has(base) || base.endsWith(".json")) return true;
  if (base === "yarn.lock" || base === "pnpm-lock.yaml" || base === "bun.lock") return true;
  if (TEXT_EXTENSIONS.has(path.extname(base))) return true;
  return EXTENSIONLESS_ALLOW.has(base) || base.startsWith("dockerfile");
}

/**
 * Accepts a repository-relative POSIX path. Rejects absolute paths, "..", empty segments
 * and anything under a skipped directory, so a crafted archive cannot name files outside
 * the repository or smuggle in vendored trees.
 */
export function isIndexablePath(relativePath: string): boolean {
  if (relativePath === "" || relativePath.startsWith("/") || relativePath.includes("\\")) return false;
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return false;
  if (segments.slice(0, -1).some((dir) => SKIP_DIRS.has(dir))) return false;
  return isAllowedFileName(segments[segments.length - 1]);
}
