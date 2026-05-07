import { env } from "../config/env.js";
import type { RetrievedChunk } from "./retrieval.js";
import { isBedrockConfigured, synthesizeWithBedrock } from "./bedrockSynthesizer.js";

function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .slice(0, 6)
    .map(
      (chunk, idx) =>
        `[${idx + 1}] ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n${chunk.content.slice(0, 700)}`
    )
    .join("\n\n");
}

export async function synthesizeWithAi(
  question: string,
  chunks: RetrievedChunk[],
  structureSummary?: string
): Promise<string | undefined> {
  if (chunks.length === 0) {
    return undefined;
  }

  // Prefer Bedrock when fully configured (e.g. Claude via AWS).
  if (isBedrockConfigured()) {
    const bedrockAnswer = await synthesizeWithBedrock(question, chunks, structureSummary);
    if (bedrockAnswer) {
      return bedrockAnswer;
    }
  }

  if (!env.openAiApiKey) {
    return undefined;
  }

  const body = {
    model: env.openAiModel,
    temperature: env.openAiTemperature,
    messages: [
      {
        role: "system",
        content:
          [
            "You are a senior code investigator.",
            "Use ONLY the provided snippets as evidence.",
            "Prefer describing business/domain purpose, runtime flow, and architecture from README/package/entry files.",
            "Do NOT frame config files (tsconfig/eslint/prettier) as repository purpose unless user explicitly asks about config.",
            "If evidence is weak, say that clearly."
          ].join(" ")
      },
      {
        role: "user",
        content: [
          `Question: ${question}`,
          structureSummary ? `Repository structure context:\n${structureSummary}` : "",
          "Evidence snippets (with file and lines):",
          buildContext(chunks),
          "Respond with three sections exactly:",
          "1) Direct answer",
          "2) Architecture/behavior notes",
          "3) Caveats",
          "Keep the answer human and specific. Mention 2-4 evidence-backed points."
        ].join("\n\n")
      }
    ]
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openAiApiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      return undefined;
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || undefined;
  } catch {
    return undefined;
  }
}
