export interface AuditView {
  verdict: "pass" | "warn" | "fail";
  trustScore: number;
  issues: { type: string; severity: string; message: string }[];
}

const VERDICT_LABEL: Record<AuditView["verdict"], string> = {
  pass: "Pass",
  warn: "Review",
  fail: "Weak evidence"
};

export function AuditBadge({ audit }: { audit: AuditView }) {
  return (
    <section className={`audit audit--${audit.verdict}`} aria-label="Audit">
      <p className="audit__verdict">
        <span className="audit__pill">{VERDICT_LABEL[audit.verdict]}</span>
        <span className="audit__score">heuristic score {audit.trustScore}/100</span>
      </p>
      {audit.issues.length > 0 ? (
        <ul className="audit__issues">
          {audit.issues.map((issue, idx) => (
            <li key={`${issue.type}-${idx}`}>
              <span className={`severity severity--${issue.severity}`}>{issue.severity}</span> {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="subtle">No issues flagged.</p>
      )}
    </section>
  );
}
