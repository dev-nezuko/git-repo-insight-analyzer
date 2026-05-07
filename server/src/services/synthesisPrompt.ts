import type { RetrievedChunk } from "./retrieval.js";

const SNIPPET_LIMIT = 6;
const SNIPPET_CHARS = 700;

/** One prompt for every provider, so OpenAI and Bedrock answers are judged on the same evidence. */
export function buildSynthesisPrompt(
  question: string,
  chunks: RetrievedChunk[],
  structureSummary?: string
): { system: string; user: string } {
  const evidence = chunks
    .slice(0, SNIPPET_LIMIT)
    .map(
      (chunk, idx) =>
        `[${idx + 1}] ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n${chunk.content.slice(0, SNIPPET_CHARS)}`
    )
    .join("\n\n");

  const system = [
    "You are a senior code investigator.",
    "Use ONLY the provided snippets as evidence.",
    "Prefer describing business/domain purpose, runtime flow, and architecture from README/package/entry files.",
    "Do NOT frame config files (tsconfig/eslint/prettier) as repository purpose unless user explicitly asks about config.",
    "If evidence is weak, say that clearly."
  ].join(" ");

  const user = [
    `Question: ${question}`,
    structureSummary ? `Repository structure context:\n${structureSummary}` : "",
    "Evidence snippets (with file and lines):",
    evidence,
    "Respond with three sections exactly:",
    "1) Direct answer",
    "2) Architecture/behavior notes",
    "3) Caveats",
    "Keep the answer human and specific. Mention 2-4 evidence-backed points."
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}
