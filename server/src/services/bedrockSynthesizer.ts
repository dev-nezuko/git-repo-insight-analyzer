import {
  BedrockRuntimeClient,
  ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../config/env.js";
import type { RetrievedChunk } from "./retrieval.js";

function buildEvidenceBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .slice(0, 6)
    .map(
      (chunk, idx) =>
        `[${idx + 1}] ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n${chunk.content.slice(0, 700)}`
    )
    .join("\n\n");
}

function extractText(output: unknown): string | undefined {
  if (!output || typeof output !== "object") {
    return undefined;
  }
  const message = (output as { output?: { message?: { content?: unknown } } }).output?.message;
  const blocks = message?.content;
  if (!Array.isArray(blocks)) {
    return undefined;
  }
  const parts: string[] = [];
  for (const block of blocks) {
    if (block && typeof block === "object" && "text" in block && typeof (block as { text: string }).text === "string") {
      parts.push((block as { text: string }).text);
    }
  }
  const joined = parts.join("\n").trim();
  return joined || undefined;
}

export function isBedrockConfigured(): boolean {
  return Boolean(
    env.awsAccessKeyId &&
      env.awsSecretAccessKey &&
      env.awsRegion &&
      env.awsBedrockModelId
  );
}

export async function synthesizeWithBedrock(
  question: string,
  chunks: RetrievedChunk[],
  structureSummary?: string
): Promise<string | undefined> {
  if (!isBedrockConfigured() || chunks.length === 0) {
    return undefined;
  }

  const systemPrompt = [
    "You are a senior code investigator.",
    "Use ONLY the provided snippets as evidence.",
    "Prefer describing business/domain purpose, runtime flow, and architecture from README/package/entry files.",
    "Do NOT frame config files (tsconfig/eslint/prettier) as repository purpose unless user explicitly asks about config.",
    "If evidence is weak, say that clearly."
  ].join(" ");

  const userPrompt = [
    `Question: ${question}`,
    structureSummary ? `Repository structure context:\n${structureSummary}` : "",
    "Evidence snippets (with file and lines):",
    buildEvidenceBlock(chunks),
    "Respond with three sections exactly:",
    "1) Direct answer",
    "2) Architecture/behavior notes",
    "3) Caveats",
    "Keep the answer human and specific. Mention 2-4 evidence-backed points."
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new BedrockRuntimeClient({
    region: env.awsRegion,
    credentials: {
      accessKeyId: env.awsAccessKeyId!,
      secretAccessKey: env.awsSecretAccessKey!
    }
  });

  try {
    const response = await client.send(
      new ConverseCommand({
        modelId: env.awsBedrockModelId!,
        system: [{ text: systemPrompt }],
        messages: [
          {
            role: "user",
            content: [{ text: userPrompt }]
          }
        ],
        inferenceConfig: {
          maxTokens: 4096,
          temperature: env.openAiTemperature
        }
      })
    );
    return extractText(response)?.trim();
  } catch {
    return undefined;
  }
}
