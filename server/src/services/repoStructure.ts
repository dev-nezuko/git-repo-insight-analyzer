import path from "node:path";
import { Types } from "mongoose";
import { RepoFileModel } from "../models/RepoFile.js";

function isEntryCandidate(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);
  return (
    base === "readme.md" ||
    base === "package.json" ||
    base === "angular.json" ||
    /(^|\/)(main|index|app)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(lower) ||
    lower.endsWith("vite.config.ts") ||
    lower.endsWith("next.config.js")
  );
}

export interface RepoStructureContext {
  topLevelDirs: string[];
  entryFiles: string[];
  sourceFolders: string[];
  summaryText: string;
}

export async function getRepoStructureContext(repoId: string): Promise<RepoStructureContext> {
  const objectId = new Types.ObjectId(repoId);
  const files = await RepoFileModel.find({ repoId: objectId }).select("filePath topLevelDir isEntryCandidate isSource").lean();

  const topLevelDirs = Array.from(new Set(files.map((f) => String(f.topLevelDir)))).slice(0, 10);
  const entryFiles = files
    .filter((f) => Boolean(f.isEntryCandidate) || isEntryCandidate(String(f.filePath)))
    .map((f) => String(f.filePath))
    .slice(0, 10);
  const sourceFolders = topLevelDirs.filter((dir) => /src|app|server|client|api|services|controllers|models/i.test(dir));

  const summaryText = [
    `Top-level directories: ${topLevelDirs.length ? topLevelDirs.join(", ") : "none"}`,
    `Entry files: ${entryFiles.length ? entryFiles.join(", ") : "none"}`,
    `Source-oriented folders: ${sourceFolders.length ? sourceFolders.join(", ") : "none"}`
  ].join("\n");

  return {
    topLevelDirs,
    entryFiles,
    sourceFolders,
    summaryText
  };
}
