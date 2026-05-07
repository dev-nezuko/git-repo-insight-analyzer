import { randomUUID } from "node:crypto";
import type { Citation, Claim } from "../types/investigator.js";
import type { RetrievedChunk } from "./retrieval.js";
import {
  isAuthQuestion,
  isBehaviorQuestion,
  isDeadCodeQuestion,
  isOverviewQuestion,
  isServiceWalkthroughQuestion
} from "../utils/questionIntent.js";
import { isToolingConfig } from "../utils/repoPaths.js";
import { topicKeyFromText } from "../utils/text.js";
import { synthesizeWithAi } from "./aiSynthesizer.js";

function polarityForSentence(sentence: string): "positive" | "negative" | "neutral" {
  const s = sentence.toLowerCase();
  if (/\b(no|not|never|none|unsafe|risk|broken|missing)\b/.test(s)) {
    return "negative";
  }
  if (/\b(good|safe|clear|works|robust|improved)\b/.test(s)) {
    return "positive";
  }
  return "neutral";
}

function buildCitation(chunk: RetrievedChunk): Citation {
  return {
    chunkId: chunk.chunkId,
    filePath: chunk.filePath,
    startLine: chunk.startLine,
    endLine: chunk.endLine
  };
}

function inferQuestionIntent(question: string): string {
  if (isDeadCodeQuestion(question)) {
    return "You're checking for unused code and deletion safety.";
  }
  if (isAuthQuestion(question)) {
    return "You're asking how the authentication flow works and whether it's sound.";
  }
  if (isOverviewQuestion(question)) {
    return "You're asking for a high-level explanation of what this repository does and how it is structured.";
  }
  if (/\basync\b/i.test(question)) {
    return "You're validating whether async behavior is actually needed.";
  }
  if (/\berrors?\b/i.test(question)) {
    return "You're evaluating how errors are handled and where resilience can improve.";
  }
  return "You're asking for a focused investigation of how this part of the code behaves.";
}

function summarizeTopLevelAreas(chunks: RetrievedChunk[]): string {
  const areaCounts = new Map<string, number>();
  for (const chunk of chunks) {
    const top = chunk.filePath.split("/")[0] ?? chunk.filePath;
    areaCounts.set(top, (areaCounts.get(top) ?? 0) + 1);
  }
  return Array.from(areaCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([area]) => area)
    .join(", ");
}

function buildDeterministicNarrative(question: string, selected: RetrievedChunk[], structureSummary?: string): string {
  const citationsRef = selected
    .slice(0, 2)
    .map((chunk) => `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`)
    .join(", ");
  const bullets = selected.map((chunk, index) => {
    const firstLine = chunk.content.split("\n")[0]?.trim() ?? "";
    return `${index + 1}. ${chunk.filePath}:${chunk.startLine}-${chunk.endLine} - ${firstLine.slice(0, 140)}`;
  });

  if (isOverviewQuestion(question)) {
    const nonConfig = selected.filter((chunk) => !isToolingConfig(chunk.filePath));
    if (nonConfig.length === 0) {
      return [
        "Direct answer: I don't have enough high-quality architecture evidence yet.",
        "",
        "Architecture notes:",
        "- Current matches are configuration-only files, which are not reliable for explaining business purpose or runtime architecture.",
        "- I need README, package.json, and application entrypoints to answer this accurately.",
        "",
        "Caveat:",
        "Please re-import the repository (fresh indexing) and ask again, or ask me to list top-level files first."
      ].join("\n");
    }

    const areas = summarizeTopLevelAreas(selected);
    return [
      `Direct answer: This repository appears to center around ${areas || "core application modules"}, based on the indexed entry points and module structure.`,
      "",
      "Architecture notes:",
      structureSummary ? `- Repository structure snapshot: ${structureSummary.replace(/\n/g, " | ")}.` : "",
      `- The strongest architecture evidence is in ${citationsRef}.`,
      "- The structure suggests separated concerns (entry/config, service logic, and integration points) rather than a single monolith file.",
      "",
      "What I found in the code:",
      ...bullets,
      "",
      "Caveat:",
      "This summary is grounded only in the cited ranges. If you want a full architecture map, ask me to enumerate all top-level directories and main entry files."
    ].join("\n");
  }

  if (isDeadCodeQuestion(question)) {
    return [
      "Direct answer: Unused/dead code cannot be proven safely from lexical search alone.",
      "",
      "What I surfaced for manual review:",
      ...bullets,
      "",
      "Why this matters:",
      "Safe deletion needs reference checks across entry points, Angular module declarations, routing, imports, templates, dynamic imports, DI providers, tests, CI, API usage, worker jobs, cron, infra, and codegen/migrations/tools.",
      "Treat these files as suspects only.",
      "",
      "Caveat:",
      "If you confirm an export is unreachable (no callers in repo/tests), cite that path for a narrow follow-up investigation."
    ].join("\n");
  }

  if (isServiceWalkthroughQuestion(question)) {
    const serviceChunks = selected.filter(
      (c) => /\.service\.(ts|js)$/i.test(c.filePath) || /\/services\//i.test(c.filePath)
    );
    const specNoise = selected.filter((c) => /\.spec\.(ts|js)$/i.test(c.filePath)).length;
    if (serviceChunks.length === 0 && specNoise >= 1) {
      return [
        "Direct answer: The best evidence for what this service does was not in the top matches (too much README/spec surface area).",
        "",
        "What I found in the code:",
        ...bullets,
        "",
        "Caveat:",
        "Ask specifically for `*.service.ts` under `src/app` or `server/`, or paste a service class name."
      ].join("\n");
    }
  }

  if (isBehaviorQuestion(question)) {
    const sourceLike = selected.filter(
      (chunk) => !isToolingConfig(chunk.filePath) && !chunk.filePath.toLowerCase().endsWith("readme.md")
    );
    if (sourceLike.length < 2) {
      return [
        "Direct answer: I do not yet have enough runtime-code evidence to answer this behavior question accurately.",
        "",
        "What I found in the code:",
        ...bullets,
        "",
        "Why this matters:",
        "Most matches are docs/config files, not business logic paths. Ask for a specific feature file/module or re-import with source-heavy chunks to get a reliable behavior trace."
      ].join("\n");
    }
  }

  return [
    `Direct answer: ${inferQuestionIntent(question)} The strongest evidence is in ${citationsRef}.`,
    "",
    "What I found in the code:",
    ...bullets,
    "",
    "Why this matters:",
    "These ranges are the highest-signal matches for your question. Use them as primary evidence, then confirm neighboring call-sites before making refactors or deletions."
  ].join("\n");
}

export async function buildAnswer(
  question: string,
  chunks: RetrievedChunk[],
  structureSummary?: string
): Promise<{
  answer: string;
  citations: Citation[];
  claims: Claim[];
  nonTrivial: boolean;
}> {
  if (chunks.length === 0) {
    const text =
      "I couldn't find enough direct evidence for that question yet. If you share a module, function, or endpoint name, I can investigate it precisely and cite exact file/line ranges.";
    return { answer: text, citations: [], claims: [], nonTrivial: false };
  }

  const selected = chunks.slice(0, 4);
  const fallbackAnswer = buildDeterministicNarrative(question, selected, structureSummary);
  const aiAnswer = await synthesizeWithAi(question, selected, structureSummary);
  const answer = aiAnswer ?? fallbackAnswer;

  const citations = selected.map(buildCitation);
  const claims: Claim[] = [
    {
      id: randomUUID(),
      text: "The listed files are direct evidence for the question.",
      topicKey: topicKeyFromText(question),
      polarity: "neutral",
      citations
    },
    {
      id: randomUUID(),
      text: "Any structural change should be validated against call-sites.",
      topicKey: "change_validation_callsites",
      polarity: polarityForSentence("should be validated"),
      citations: citations.slice(0, 1)
    }
  ];

  return { answer, citations, claims, nonTrivial: true };
}
