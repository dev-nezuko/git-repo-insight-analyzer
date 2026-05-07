import { env } from "../config/env.js";
import type { RetrievedChunk } from "./retrieval.js";
import { isBedrockConfigured, synthesizeWithBedrock } from "./bedrockSynthesizer.js";
import { buildSynthesisPrompt } from "./synthesisPrompt.js";

const OPENAI_TIMEOUT_MS = 45_000;

/**
 * Returns a model-written answer, or undefined so the caller falls back to the
 * deterministic narrative. Bedrock is tried first when fully configured, then OpenAI.
 */
export async function synthesizeWithAi(
  question: string,
  chunks: RetrievedChunk[],
  structureSummary?: string
): Promise<string | undefined> {
  if (chunks.length === 0) {
    return undefined;
  }

  if (isBedrockConfigured()) {
    const bedrockAnswer = await synthesizeWithBedrock(question, chunks, structureSummary);
    if (bedrockAnswer) {
      return bedrockAnswer;
    }
  }

  if (!env.openAiApiKey) {
    return undefined;
  }

  const prompt = buildSynthesisPrompt(question, chunks, structureSummary);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openAiApiKey}`
      },
      body: JSON.stringify({
        model: env.openAiModel,
        temperature: env.openAiTemperature,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ]
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS)
    });
    if (!response.ok) {
      return undefined;
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || undefined;
  } catch {
    // Network failures and timeouts fall back to the deterministic answer.
    return undefined;
  }
}
