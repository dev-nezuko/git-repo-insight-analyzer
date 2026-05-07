export function applyAuditGate(answer: string, nonTrivial: boolean, verdict: "pass" | "warn" | "fail"): string {
  if (!nonTrivial || verdict !== "fail") {
    return answer;
  }
  return `${answer}\n\nAudit gate: low trust result. Please narrow the question or request specific file/function verification.`;
}
