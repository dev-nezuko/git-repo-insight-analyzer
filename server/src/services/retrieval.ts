import path from "node:path";
import { Types } from "mongoose";
import { ChunkModel } from "../models/Chunk.js";
import { scoreOverlap } from "../utils/text.js";

export interface RetrievedChunk {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

type LeanChunk = {
  _id: unknown;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
};

function isNoiseFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith("package-lock.json") ||
    lower.endsWith("yarn.lock") ||
    lower.endsWith("pnpm-lock.yaml") ||
    lower.endsWith("bun.lockb") ||
    lower.includes("/dist/") ||
    lower.includes("/build/") ||
    lower.includes(".min.js")
  );
}

function isOverviewQuestion(question: string): boolean {
  return /what is this repo about|what.*repository.*about|top[\s-]?level|high[\s-]?level|architecture|overview/.test(
    question.toLowerCase()
  );
}

function isBehaviorQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return /how|why|flow|walk|through|work|works|manage|handling|process|logic|change|improve|fix|explain|describe|risk|flag|feels|wrong|off|tell me/.test(
    q
  );
}

function isDeadCodeQuestion(question: string): boolean {
  return /dead code|unused code|never used|safe to delete|remove.*code|delete.*code|any.*unused/.test(
    question.toLowerCase()
  );
}

function isServiceWalkthroughQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return /walk me through|what .*service|this service|service does|skip the obvious/.test(q);
}

function isAuthQuestion(question: string): boolean {
  return /auth|authenticate|authentication|login|signup|sign[\s-]?up|register|token|jwt|session|password/.test(
    question.toLowerCase()
  );
}

function authKeywords(): string[] {
  return [
    "auth",
    "authenticate",
    "authentication",
    "login",
    "signin",
    "signup",
    "register",
    "session",
    "jwt",
    "token",
    "oauth",
    "passport",
    "guard",
    "middleware",
    "interceptor",
    "bcrypt",
    "credential"
  ];
}

function authRelevantPathOrContent(filePath: string, content: string, terms: string[]): boolean {
  const p = filePath.toLowerCase();
  const c = content.toLowerCase();
  if (terms.some((t) => p.includes(t))) {
    return true;
  }
  if (/\b(login|signup|sign-up|sign_up|register|password|credential|jwt|oauth|session|authenticate|authorization)\b/.test(c)) {
    return true;
  }
  return false;
}

/** Random UI chunks (e.g. stock-card) should not rank for signup/auth unless they mention auth in content or path */
function authUnlikelyComponentPath(filePath: string): boolean {
  const p = filePath.toLowerCase();
  if (!/\/components\//.test(p) && !/\/pages\//.test(p)) {
    return false;
  }
  if (/login|signup|sign-up|register|auth|account|user|credential|session/.test(p)) {
    return false;
  }
  return true;
}

function isConfigHeavyFile(filePath: string): boolean {
  const base = path.basename(filePath.toLowerCase());
  return (
    base.startsWith("tsconfig") ||
    base.endsWith(".config.js") ||
    base.endsWith(".config.ts") ||
    base.includes("eslint") ||
    base.includes("prettier")
  );
}

function overviewPathPriority(filePath: string): number {
  const p = filePath.toLowerCase();
  const base = path.basename(p);

  if (base === "readme.md" || base === "readme") {
    return 5;
  }
  if (base === "package.json") {
    return 4.5;
  }
  if (base === "angular.json" || base === "next.config.js" || base === "vite.config.ts") {
    return 3.8;
  }
  if (/^src\/(main|index|app)\./.test(p) || /^server\/src\/index\./.test(p) || /^client\/src\/main\./.test(p)) {
    return 3.6;
  }
  if (/^src\/|^server\/src\/|^client\/src\/|^app\/|^api\/|^routes\/|^services\/|^controllers\/|^models\//.test(p)) {
    return 2.4;
  }
  if (/^docs\/|\/docs\//.test(p)) {
    return 2.2;
  }
  if (isConfigHeavyFile(p)) {
    return -3;
  }
  if (base.endsWith(".json") && base !== "package.json") {
    return -1.5;
  }
  return 0.4;
}

function pathWeight(question: string, filePath: string): number {
  const q = question.toLowerCase();
  const p = filePath.toLowerCase();
  const base = path.basename(p);
  let weight = 1;

  if (isNoiseFile(p)) {
    return 0;
  }

  if (isOverviewQuestion(q)) {
    if (base === "readme.md" || base === "readme") {
      weight += 3.2;
    } else if (base === "package.json") {
      weight += 2.6;
    } else if (/^src\/(main|index|app)\./.test(p) || /^server\/src\/index\./.test(p) || /^client\/src\/main\./.test(p)) {
      weight += 2.4;
    } else if (/^src\/|^server\/src\/|^client\/src\/|^app\/|^api\/|^routes\/|^services\/|^controllers\/|^models\//.test(p)) {
      weight += 1.1;
    } else if (/^docs\/|\/docs\//.test(p)) {
      weight += 1.5;
    }

    if (isConfigHeavyFile(p)) {
      weight *= 0.04;
    } else if (base.endsWith(".json") && base !== "package.json") {
      weight *= 0.15;
    }
  }
  if (/auth|signup|login/.test(q) && /auth|user|session|token|middleware/.test(p)) {
    weight += 0.4;
  }
  if (/dead code|unused|safe to delete/.test(q) && /src\/|app\/|server\/|client\//.test(p)) {
    weight += 0.3;
  }
  return weight;
}

function isSourceLikePath(filePath: string): boolean {
  const p = filePath.toLowerCase();
  const base = path.basename(p);
  if (isConfigHeavyFile(p) || base.endsWith(".json") || base.endsWith(".md")) {
    return false;
  }
  const ext = path.extname(base);
  const isRuntimeExt = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".java", ".rs"].includes(ext);
  if (!isRuntimeExt) {
    return false;
  }
  return true;
}

function diversifyByFile(chunks: RetrievedChunk[], topK: number): RetrievedChunk[] {
  const seenPaths = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    if (seenPaths.has(chunk.filePath)) {
      continue;
    }
    seenPaths.add(chunk.filePath);
    out.push(chunk);
    if (out.length >= topK) {
      break;
    }
  }
  return out;
}

function retrieveDeadCodeCandidates(docs: LeanChunk[], question: string, topK: number): RetrievedChunk[] {
  const mapped = docs
    .map((doc): RetrievedChunk | undefined => {
      const filePath = String(doc.filePath);
      const content = String(doc.content);
      if (!isSourceLikePath(filePath) || isNoiseFile(filePath)) {
        return undefined;
      }

      const p = filePath.toLowerCase();
      const trimmed = content.trim();
      if (trimmed.length < 50) {
        return undefined;
      }

      let score = scoreOverlap(question, content);

      const lower = content.toLowerCase();
      if (/\.spec\.|\.test\.|\.e2e\./.test(p)) {
        score *= 0.45;
      }
      if (/\bexport\b|\bfunction\b|\bclass\b|\bconst\b\s+\w+\s*=/.test(lower)) {
        score += 0.15;
      }
      if (/\bunused|deprecated|dead code|todo|fixme|_unused|_unreachable\b/.test(lower)) {
        score += 0.4;
      }
      if (/^[\s})\];,]+$/m.test(trimmed.slice(0, 120))) {
        score *= 0.05;
      }
      const substantiveLines = trimmed.split("\n").filter((l) => /[a-z0-9]/i.test(l)).length;
      if (substantiveLines <= 2 && trimmed.length < 250) {
        score *= 0.25;
      }
      if (trimmed.length < 180) {
        score *= 0.65;
      }

      return {
        chunkId: String(doc._id),
        filePath,
        startLine: Number(doc.startLine),
        endLine: Number(doc.endLine),
        content,
        score
      };
    })
    .filter((item): item is RetrievedChunk => Boolean(item))
    .filter((item) => item.score > 0.02)
    .sort((a, b) => b.score - a.score);

  return diversifyByFile(mapped, topK);
}

function retrieveBehaviorChunks(docs: LeanChunk[], question: string, topK: number): RetrievedChunk[] {
  const authQuestion = isAuthQuestion(question);
  const authTerms = authKeywords();
  const serviceQ = isServiceWalkthroughQuestion(question);

  const behaviorRanked = docs
    .map((doc): RetrievedChunk | undefined => {
      const filePath = doc.filePath as string;
      if (!isSourceLikePath(filePath) || isNoiseFile(filePath)) {
        return undefined;
      }
      const content = doc.content as string;
      const overlap = scoreOverlap(question, content);
      const lowerPath = filePath.toLowerCase();
      const lowerContent = content.toLowerCase();
      let boost = 0;

      if (serviceQ) {
        if (/\.service\.(ts|js)$/.test(lowerPath) || /\/services\//.test(lowerPath)) {
          boost += 0.55;
        }
        if (/\binjectable\b|\bprovidedin\b|\bservice\b/.test(lowerContent)) {
          boost += 0.15;
        }
      }

      if (authQuestion) {
        if (authRelevantPathOrContent(filePath, content, authTerms)) {
          if (authTerms.some((term) => lowerPath.includes(term))) {
            boost += 0.55;
          }
          if (authTerms.some((term) => lowerContent.includes(term))) {
            boost += 0.3;
          }
        } else if (authUnlikelyComponentPath(filePath)) {
          boost -= 0.85;
        }
        if (boost > 0 && overlap < 0.06) {
          boost += 0.12;
        }
      }

      return {
        chunkId: String(doc._id),
        filePath,
        startLine: doc.startLine as number,
        endLine: doc.endLine as number,
        content,
        score: overlap + boost
      };
    })
    .filter((item): item is RetrievedChunk => Boolean(item));

  let pool = behaviorRanked.filter((item) => item.score > (authQuestion ? 0.04 : 0.05)).sort((a, b) => b.score - a.score);

  if (authQuestion) {
    const strict = pool.filter((c) => authRelevantPathOrContent(c.filePath, c.content, authTerms));
    if (strict.length >= 2) {
      pool = strict.sort((a, b) => b.score - a.score);
    } else if (strict.length === 1) {
      const rest = pool.filter((c) => c.chunkId !== strict[0].chunkId);
      pool = [...strict, ...rest].sort((a, b) => b.score - a.score);
    } else {
      const fallback = docs
        .map((doc): RetrievedChunk | undefined => {
          const filePath = String(doc.filePath);
          const content = String(doc.content);
          if (!isSourceLikePath(filePath) || isNoiseFile(filePath)) {
            return undefined;
          }
          const lowerPath = filePath.toLowerCase();
          const lowerContent = content.toLowerCase();
          let hits = 0;
          for (const term of authTerms) {
            if (lowerPath.includes(term)) {
              hits += 3;
            }
            if (lowerContent.includes(term)) {
              hits += 1;
            }
          }
          if (
            /\b(login|signup|register|password|credential|jwt|session|authenticate|oauth)\b/.test(lowerContent)
          ) {
            hits += 2;
          }
          if (hits === 0) {
            return undefined;
          }
          return {
            chunkId: String(doc._id),
            filePath,
            startLine: Number(doc.startLine),
            endLine: Number(doc.endLine),
            content,
            score: hits + scoreOverlap(question, content) * 0.2
          };
        })
        .filter((item): item is RetrievedChunk => Boolean(item))
        .sort((a, b) => b.score - a.score);
      pool = fallback.length ? fallback : pool;
    }
  }

  return diversifyByFile(pool.sort((a, b) => b.score - a.score), topK);
}

export async function retrieveRelevantChunks(repoId: string, question: string, topK = 8): Promise<RetrievedChunk[]> {
  const docs = (await ChunkModel.find({ repoId: new Types.ObjectId(repoId) })
    .select("_id filePath startLine endLine content")
    .lean()) as LeanChunk[];

  const ranked = docs
    .map((doc) => ({
      chunkId: String(doc._id),
      filePath: doc.filePath as string,
      startLine: doc.startLine as number,
      endLine: doc.endLine as number,
      content: doc.content as string,
      score: scoreOverlap(question, doc.content as string) * pathWeight(question, doc.filePath as string)
    }))
    .filter((item) => item.score > (isOverviewQuestion(question) ? 0.01 : 0.04))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (isDeadCodeQuestion(question)) {
    const dead = retrieveDeadCodeCandidates(docs, question, topK);
    return dead.length > 0 ? dead : ranked;
  }

  if (isOverviewQuestion(question) && !isBehaviorQuestion(question)) {
    const overviewRanked = docs
      .map((doc) => {
        const filePath = doc.filePath as string;
        const baseScore = overviewPathPriority(filePath);
        const overlap = scoreOverlap(question, doc.content as string);
        return {
          chunkId: String(doc._id),
          filePath,
          startLine: doc.startLine as number,
          endLine: doc.endLine as number,
          content: doc.content as string,
          score: baseScore + overlap * 0.5
        };
      })
      .filter((item) => item.score > 0.3 && !isConfigHeavyFile(item.filePath))
      .sort((a, b) => b.score - a.score);

    const diversified = diversifyByFile(overviewRanked, topK).filter((c) => c.startLine <= 220);
    return diversified.length > 0 ? diversified : ranked;
  }

  if (isBehaviorQuestion(question)) {
    const behavior = retrieveBehaviorChunks(docs, question, topK);
    return behavior.length > 0 ? behavior : ranked;
  }

  return ranked;
}
