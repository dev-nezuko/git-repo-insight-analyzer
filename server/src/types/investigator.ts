export interface Citation {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface Claim {
  id: string;
  text: string;
  topicKey: string;
  polarity: "positive" | "negative" | "neutral";
  citations: Citation[];
}

export interface AuditIssue {
  type: "hallucination" | "reasoning_gap" | "risky_fix" | "contradiction";
  severity: "low" | "medium" | "high";
  message: string;
}

export interface AuditResult {
  verdict: "pass" | "warn" | "fail";
  trustScore: number;
  issues: AuditIssue[];
  checks: {
    citationIntegrity: boolean;
    quoteOverlap: boolean;
  };
}
