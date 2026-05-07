import crypto from "node:crypto";

export interface ChunkInput {
  filePath: string;
  content: string;
}

export interface ChunkOutput {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  contentHash: string;
}

const MAX_LINES_PER_CHUNK = 60;
const OVERLAP_LINES = 8;

export function chunkFile(input: ChunkInput): ChunkOutput[] {
  const lines = input.content.split("\n");
  if (lines.length === 0) {
    return [];
  }

  const chunks: ChunkOutput[] = [];
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + MAX_LINES_PER_CHUNK, lines.length);
    const segment = lines.slice(start, end).join("\n").trim();
    if (segment) {
      const contentHash = crypto.createHash("sha256").update(segment).digest("hex");
      chunks.push({
        filePath: input.filePath,
        startLine: start + 1,
        endLine: end,
        content: segment,
        contentHash
      });
    }
    if (end === lines.length) {
      break;
    }
    start = Math.max(0, end - OVERLAP_LINES);
  }

  return chunks;
}
