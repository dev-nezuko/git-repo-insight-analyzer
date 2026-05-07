interface Props {
  verdict: "pass" | "warn" | "fail";
  trustScore: number;
  issues: { type: string; severity: string; message: string }[];
}

export function AuditBadge({ verdict, trustScore, issues }: Props) {
  const color = verdict === "pass" ? "#1a7f37" : verdict === "warn" ? "#9a6700" : "#cf222e";

  return (
    <div style={{ border: `1px solid ${color}`, padding: 10, borderRadius: 8, marginTop: 10 }}>
      <strong style={{ color }}>{verdict.toUpperCase()}</strong> ({trustScore}/100)
      {issues.length > 0 && (
        <ul>
          {issues.map((issue, idx) => (
            <li key={`${issue.type}-${idx}`}>
              [{issue.severity}] {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
