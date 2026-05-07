import path from "node:path";

/** Files that usually reveal what a repository is and where it starts. */
export function isEntryCandidate(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const base = path.posix.basename(lower);
  return (
    base === "readme.md" ||
    base === "package.json" ||
    base === "angular.json" ||
    /^(vite|next)\.config\.(ts|js|mjs)$/.test(base) ||
    /(^|\/)(main|index|app)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(lower)
  );
}

/** Tooling configuration that says little about what the code does. */
export function isToolingConfig(filePath: string): boolean {
  const base = path.posix.basename(filePath.toLowerCase());
  return (
    base.startsWith("tsconfig") ||
    base.includes("eslint") ||
    base.includes("prettier") ||
    /\.config\.(ts|js|mjs|cjs)$/.test(base)
  );
}
