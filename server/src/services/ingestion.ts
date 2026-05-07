import path from "node:path";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { HttpError } from "../httpError.js";
import { RepoModel } from "../models/Repo.js";
import { ChunkModel } from "../models/Chunk.js";
import { RepoFileModel } from "../models/RepoFile.js";
import { chunkFile } from "../utils/chunker.js";
import { parseGithubUrl, type GithubRepoRef } from "../utils/github.js";
import { isEntryCandidate, isToolingConfig } from "../utils/repoPaths.js";
import { ArchiveLimitError, readRepoArchive } from "./archive.js";
import { downloadArchive } from "./download.js";

const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_CONCURRENT_IMPORTS = 2;

/** Imports hold a whole archive in memory, so only a couple may run at once per process. */
const activeImports = new Set<string>();

export async function importRepository(githubUrl: string): Promise<{ repoId: string; fileCount: number; chunkCount: number }> {
  const parsed = parseGithubUrl(githubUrl);
  if (activeImports.has(parsed.canonicalUrl)) {
    throw new HttpError(409, "This repository is already being imported.");
  }
  if (activeImports.size >= MAX_CONCURRENT_IMPORTS) {
    throw new HttpError(429, "Too many imports are running. Try again shortly.");
  }
  activeImports.add(parsed.canonicalUrl);
  try {
    return await indexRepository(parsed);
  } finally {
    activeImports.delete(parsed.canonicalUrl);
  }
}

async function indexRepository(
  parsed: GithubRepoRef
): Promise<{ repoId: string; fileCount: number; chunkCount: number }> {
  const existing = await RepoModel.findOne({ githubUrl: parsed.canonicalUrl });
  const repo = existing ?? new RepoModel({ githubUrl: parsed.canonicalUrl, owner: parsed.owner, name: parsed.repo });
  repo.status = "processing";
  repo.lastError = undefined;
  await repo.save();

  try {
    const zipUrl = `${env.githubApiUrl}/repos/${parsed.owner}/${parsed.repo}/zipball`;
    const archive = await downloadArchive(zipUrl, {
      maxBytes: env.importMaxArchiveMb * 1024 * 1024,
      timeoutMs: DOWNLOAD_TIMEOUT_MS
    });

    let files;
    try {
      ({ files } = readRepoArchive(archive));
    } catch (error) {
      if (error instanceof ArchiveLimitError) throw new HttpError(413, error.message);
      throw error;
    }

    await ChunkModel.deleteMany({ repoId: repo._id as Types.ObjectId });
    await RepoFileModel.deleteMany({ repoId: repo._id as Types.ObjectId });

    if (files.length > 0) {
      await RepoFileModel.insertMany(
        files.map((file) => {
          const ext = path.extname(file.relativePath).toLowerCase();
          const topLevelDir = file.relativePath.includes("/") ? file.relativePath.split("/")[0] : ".";
          const source = /^src\/|^app\/|^server\/src\/|^client\/src\/|^api\/|^services\/|^controllers\/|^models\//.test(
            file.relativePath.toLowerCase()
          );
          return {
            repoId: repo._id,
            filePath: file.relativePath,
            topLevelDir,
            extension: ext || "none",
            lineCount: file.content.split("\n").length,
            isEntryCandidate: isEntryCandidate(file.relativePath),
            isConfig: isToolingConfig(file.relativePath),
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
    repo.lastError = error instanceof HttpError ? error.message : "Import failed";
    await repo.save();
    throw error;
  }
}
