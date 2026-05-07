import type { AuditIssue, AuditResult, Citation } from "../types/investigator.js";
import { ChunkModel } from "../models/Chunk.js";

function quoteOverlapCheck(answer: string, snippets: string[]): boolean {
  const normalizedAnswer = answer.toLowerCase();
  return snippets.some((snippet) => {
    const probe = snippet.split("\n")[0]?.trim().toLowerCase();
    return probe ? normalizedAnswer.includes(probe.slice(0, 20)) : false;
  });
}

export async function runAudit(
  question: string,
  answer: string,
  citations: Citation[]
): Promise<AuditResult> {
  const issues: AuditIssue[] = [];
  let citationIntegrity = true;
  const citedPaths: string[] = [];

  const chunks = await Promise.all(
    citations.map(async (citation) => {
      const doc = await ChunkModel.findById(citation.chunkId).lean();
      if (!doc) {
        citationIntegrity = false;
        issues.push({
          type: "hallucination",
          severity: "high",
          message: `Citation ${citation.chunkId} does not exist in index.`
        });
        return undefined;
      }
      if (doc.filePath !== citation.filePath || citation.startLine > citation.endLine) {
        citationIntegrity = false;
        issues.push({
          type: "hallucination",
          severity: "high",
          message: `Citation range/path mismatch for ${citation.filePath}:${citation.startLine}-${citation.endLine}.`
        });
      }
      citedPaths.push(String(doc.filePath));
      return String(doc.content ?? "");
    })
  );

  if (citations.length === 0 && answer.length > 80) {
    issues.push({
      type: "reasoning_gap",
      severity: "high",
      message: "Non-trivial answer has no citations."
    });
  }

  if (/delete|remove|drop/i.test(answer) && !/call-site|callsite|reference/i.test(answer)) {
    issues.push({
      type: "risky_fix",
      severity: "medium",
      message: "Suggested deletion without call-site safety caveat."
    });
  }

  const snippets = chunks.filter((v): v is string => Boolean(v));
  const quoteOverlap = snippets.length === 0 ? false : quoteOverlapCheck(answer, snippets);
  if (!quoteOverlap && citations.length > 0) {
    issues.push({
      type: "reasoning_gap",
      severity: "medium",
      message: "Answer does not appear to reference cited snippet content."
    });
  }

  if (/\b(always|definitely|guaranteed)\b/i.test(answer) && citations.length < 2) {
    issues.push({
      type: "reasoning_gap",
      severity: "medium",
      message: "Over-confident language with weak evidence."
    });
  }

  const lowerQuestion = question.toLowerCase();
  const behaviorQuestion = /how|why|flow|work|works|manage|handling|process|logic/.test(lowerQuestion);
  const lowSignalForBehavior = citedPaths.filter((p) => {
    const lower = p.toLowerCase();
    return (
      lower.endsWith("readme.md") ||
      lower.includes("tsconfig") ||
      lower.endsWith("package.json") ||
      lower.endsWith(".json") ||
      lower.includes("angular.json")
    );
  });

  if (behaviorQuestion && citedPaths.length > 0 && lowSignalForBehavior.length / citedPaths.length >= 0.6) {
    issues.push({
      type: "reasoning_gap",
      severity: "high",
      message: "Behavior question is backed mostly by docs/config citations instead of runtime source code."
    });
  }

  const signupAuthQuestion = /signup|sign-up|sign up|register|authentication|credential|logout|jwt|oauth|password\b/.test(
    lowerQuestion
  );
  if (signupAuthQuestion && citations.length > 0) {
    const pathHint = citedPaths.some((p) =>
      /auth|login|signup|register|account|user|session|credential|jwt|middleware|guard|interceptor|routes?\//i.test(p)
    );
    const snippetHint = snippets.some((s) =>
      /\b(login|signup|sign-up|sign_up|register|password|credential|jwt|session|authenticate|authorize|oauth|guard)\b/i.test(s)
    );
    if (!pathHint && !snippetHint) {
      issues.push({
        type: "reasoning_gap",
        severity: "high",
        message: "Auth/sign-up question cites files that show no authentication-related paths or snippets."
      });
    }
  }

  const deadQuestion = /dead code|safe to delete|unused code/.test(lowerQuestion);
  if (deadQuestion && citations.length > 0) {
    const hasDeletionSignal = snippets.some((s) =>
      /\b(export|function|class|deprecated|unused|TODO|FIXME|unreachable)\b/i.test(s)
    );
    if (!hasDeletionSignal) {
      issues.push({
        type: "reasoning_gap",
        severity: "high",
        message: "Dead-code question is not backed by code chunks that expose exports or obvious unused markers."
      });
    }
  }

  const serviceQuestion = /service does|this service|skip the obvious|walk me through/.test(lowerQuestion);
  if (serviceQuestion && citations.length > 0) {
    const serviceCitation = citedPaths.some(
      (p) => /\.service\.(ts|js)$/i.test(p) || /\/services\//i.test(p)
    );
    const readmeSpecCount = citedPaths.filter(
      (p) => /\.spec\.|readme\.md$/i.test(p) || /\/readme/i.test(p)
    ).length;
    if (!serviceCitation && readmeSpecCount >= Math.ceil(citations.length * 0.5)) {
      issues.push({
        type: "reasoning_gap",
        severity: "high",
        message: "Service walkthrough should cite implementation files (*.service.ts, /services/); citations skew to README/tests."
      });
    }
  }

  if (/contradict/i.test(question)) {
    issues.push({
      type: "contradiction",
      severity: "low",
      message: "Question asks contradiction follow-up; verify prior turn alignment."
    });
  }

  const trustScore = Math.max(0, 100 - issues.length * 25);
  const hasHighIssue = issues.some((issue) => issue.severity === "high");
  const verdict: AuditResult["verdict"] = hasHighIssue
    ? trustScore >= 55
      ? "warn"
      : "fail"
    : trustScore >= 85
      ? "pass"
      : trustScore >= 50
        ? "warn"
        : "fail";

  return {
    verdict,
    trustScore,
    issues,
    checks: {
      citationIntegrity,
      quoteOverlap
    }
  };
}
