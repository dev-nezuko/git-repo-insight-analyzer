import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import AdmZip from "adm-zip";
import { Types } from "mongoose";
import { RepoModel } from "../models/Repo.js";
import { ChunkModel } from "../models/Chunk.js";
import { RepoFileModel } from "../models/RepoFile.js";
import { collectTextFiles } from "../utils/fileWalker.js";
import { chunkFile } from "../utils/chunker.js";
import { parseGithubUrl } from "../utils/github.js";

const DATA_ROOT = path.resolve(process.cwd(), "data", "repos");

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function pickExtractRoot(entries: string[]): string {
  const first = entries[0] ?? "";
  return first.split("/")[0] ?? "";
}

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

function isConfigFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);
  return (
    base.startsWith("tsconfig") ||
    base.includes("eslint") ||
    base.includes("prettier") ||
    lower.endsWith(".config.ts") ||
    lower.endsWith(".config.js")
  );
}

export async function importRepository(githubUrl: string): Promise<{ repoId: string; fileCount: number; chunkCount: number }> {
  const parsed = parseGithubUrl(githubUrl);
  const existing = await RepoModel.findOne({ githubUrl });
  const repo = existing ?? new RepoModel({ githubUrl, owner: parsed.owner, name: parsed.repo });
  repo.status = "processing";
  repo.lastError = undefined;
  await repo.save();

  try {
    const zipUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/zipball`;
    const response = await axios.get<ArrayBuffer>(zipUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "agents-anywhere-investigator" }
    });

    await ensureDir(DATA_ROOT);
    const repoDir = path.join(DATA_ROOT, String(repo._id));
    await fs.rm(repoDir, { recursive: true, force: true });
    await ensureDir(repoDir);

    const zip = new AdmZip(Buffer.from(response.data));
    zip.extractAllTo(repoDir, true);

    const zipEntries = zip.getEntries().map((entry) => entry.entryName);
    const rootFolder = pickExtractRoot(zipEntries);
    const extractedRoot = rootFolder ? path.join(repoDir, rootFolder) : repoDir;

    const files = await collectTextFiles(extractedRoot);
    await ChunkModel.deleteMany({ repoId: repo._id as Types.ObjectId });
    await RepoFileModel.deleteMany({ repoId: repo._id as Types.ObjectId });

    if (files.length > 0) {
      await RepoFileModel.insertMany(
        files.map((file) => {
          const ext = path.extname(file.relativePath).toLowerCase();
          const topLevelDir = file.relativePath.includes("/") ? file.relativePath.split("/")[0] ?? file.relativePath : ".";
          const lineCount = file.content.split("\n").length;
          const config = isConfigFile(file.relativePath);
          const source = /^src\/|^app\/|^server\/src\/|^client\/src\/|^api\/|^services\/|^controllers\/|^models\//.test(
            file.relativePath.toLowerCase()
          );
          return {
            repoId: repo._id,
            filePath: file.relativePath,
            topLevelDir,
            extension: ext || "none",
            lineCount,
            isEntryCandidate: isEntryCandidate(file.relativePath),
            isConfig: config,
            isSource: source
          };
        })
      );
    }

    const chunks = files.flatMap((file) => chunkFile({ filePath: file.relativePath, content: file.content }));
    if (chunks.length > 0) {
      await ChunkModel.insertMany(
        chunks.map((chunk) => ({
          repoId: repo._id,
          filePath: chunk.filePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          content: chunk.content,
          contentHash: chunk.contentHash,
          embedding: []
        }))
      );
    }

    repo.status = "ready";
    repo.fileCount = files.length;
    repo.chunkCount = chunks.length;
    await repo.save();

    return { repoId: String(repo._id), fileCount: files.length, chunkCount: chunks.length };
  } catch (error) {
    repo.status = "failed";
    repo.lastError = error instanceof Error ? error.message : "Unknown ingest error";
    await repo.save();
    throw error;
  }
}
