import {
  BedrockRuntimeClient,
  ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../config/env.js";
import type { RetrievedChunk } from "./retrieval.js";
import { buildSynthesisPrompt } from "./synthesisPrompt.js";

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

const BEDROCK_TIMEOUT_MS = 45_000;
let client: BedrockRuntimeClient | undefined;

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

  const prompt = buildSynthesisPrompt(question, chunks, structureSummary);

  client ??= new BedrockRuntimeClient({
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
        system: [{ text: prompt.system }],
        messages: [
          {
            role: "user",
            content: [{ text: prompt.user }]
          }
        ],
        inferenceConfig: {
          maxTokens: 4096,
          temperature: env.openAiTemperature
        }
      }),
      { abortSignal: AbortSignal.timeout(BEDROCK_TIMEOUT_MS) }
    );
    return extractText(response)?.trim();
  } catch {
    return undefined;
  }
}
