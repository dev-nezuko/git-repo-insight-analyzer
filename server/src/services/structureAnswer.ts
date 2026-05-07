import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { ChunkModel } from "../models/Chunk.js";
import { RepoFileModel } from "../models/RepoFile.js";
import type { Citation, Claim } from "../types/investigator.js";

function isStructureQuestion(question: string): boolean {
  return /enumerate|list|top[\s-]?level|main entry|entry files|folder structure|directory structure/.test(
    question.toLowerCase()
  );
}

function isLikelyEntryFile(path: string): boolean {
  const p = path.toLowerCase();
  return (
    p.endsWith("package.json") ||
    p.endsWith("readme.md") ||
    /(^|\/)(main|index|app)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p) ||
    p === "angular.json" ||
    p.endsWith("vite.config.ts") ||
    p.endsWith("next.config.js")
  );
}

export async function buildStructureAnswer(
  repoId: string,
  question: string
): Promise<{ answer: string; citations: Citation[]; claims: Claim[]; nonTrivial: boolean } | undefined> {
  if (!isStructureQuestion(question)) {
    return undefined;
  }

  const repoObjectId = new Types.ObjectId(repoId);
  const files = await RepoFileModel.find({ repoId: repoObjectId })
    .select("filePath topLevelDir isEntryCandidate")
    .sort({ filePath: 1 })
    .lean();

  if (files.length === 0) {
    return {
      answer: "I could not find indexed files for this repository yet.",
      citations: [],
      claims: [],
      nonTrivial: false
    };
  }

  const uniquePaths = files.map((file) => String(file.filePath));
  const topLevelDirs = Array.from(new Set(files.map((file) => String(file.topLevelDir)))).slice(0, 10);
  const entryFiles = files
    .filter((file) => Boolean(file.isEntryCandidate) || isLikelyEntryFile(String(file.filePath)))
    .map((file) => String(file.filePath))
    .slice(0, 10);

  const chunks = await ChunkModel.find({
    repoId: repoObjectId,
    filePath: { $in: entryFiles.length > 0 ? entryFiles : uniquePaths.slice(0, 8) }
  })
    .select("_id filePath startLine endLine")
    .sort({ filePath: 1, startLine: 1 })
    .lean();

  const citationCandidates = chunks;

  const byPath = new Map<string, { _id: unknown; filePath: string; startLine: number; endLine: number }>();
  for (const chunk of citationCandidates) {
    const filePath = String(chunk.filePath);
    if (!byPath.has(filePath)) {
      byPath.set(filePath, {
        _id: chunk._id,
        filePath,
        startLine: Number(chunk.startLine),
        endLine: Number(chunk.endLine)
      });
    }
  }

  const citations: Citation[] = Array.from(byPath.values())
    .slice(0, 8)
    .map((chunk) => ({
      chunkId: String(chunk._id),
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine
    }));

  const answer = [
    "Direct answer: Here is the repository structure from indexed files.",
    "",
    `Top-level directories: ${topLevelDirs.length ? topLevelDirs.join(", ") : "none detected"}`,
    `Main entry/config files: ${entryFiles.length ? entryFiles.join(", ") : "none detected"}`,
    "",
    "Architecture notes:",
    "- Top-level folders indicate feature and runtime separation.",
    "- Entry files show app bootstrapping and build/runtime configuration boundaries.",
    "",
    "Caveat:",
    "This is a structural map, not behavior tracing. Ask a feature-specific question (for example, stock updates flow) for runtime details."
  ].join("\n");

  const claims: Claim[] = [
    {
      id: randomUUID(),
      text: "The response lists top-level directories and likely entry files from indexed paths.",
      topicKey: "repo_structure_map",
      polarity: "neutral",
      citations
    }
  ];

  return { answer, citations, claims, nonTrivial: true };
}
