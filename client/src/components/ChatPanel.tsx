import { useState } from "react";
import { AuditBadge } from "./AuditBadge";
import { CitationList, type CitationView } from "./CitationList";

interface TurnView {
  id: string;
  question: string;
  answer: string;
  citations: CitationView[];
  audit: {
    verdict: "pass" | "warn" | "fail";
    trustScore: number;
    issues: { type: string; severity: string; message: string }[];
  };
  changedStance?: string;
}

interface Props {
  sessionId: string;
}

export function ChatPanel({ sessionId }: Props) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<TurnView[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!question.trim()) {
      return;
    }
    setLoading(true);
    const current = question;
    setQuestion("");
    const response = await fetch(`http://localhost:4000/api/chat/${sessionId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: current })
    });
    const payload = await response.json();
    setTurns((prev) => [
      ...prev,
      {
        id: payload.turnId,
        question: current,
        answer: payload.answer,
        citations: payload.citations,
        audit: payload.audit,
        changedStance: payload.changedStance
      }
    ]);
    setLoading(false);
  };

  return (
    <section>
      <h2>Investigation Chat</h2>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        placeholder="Ask about code behavior, risk, dead code, async usage..."
      />
      <br />
      <button onClick={ask} disabled={loading}>
        {loading ? "Investigating..." : "Ask"}
      </button>

      {turns.map((turn) => (
        <article key={turn.id} className="turn">
          <h3>Q: {turn.question}</h3>
          <div className="answer-text">{turn.answer}</div>
          <CitationList citations={turn.citations} />
          <AuditBadge verdict={turn.audit.verdict} trustScore={turn.audit.trustScore} issues={turn.audit.issues} />
          {turn.changedStance && <p className="changed-stance">{turn.changedStance}</p>}
        </article>
      ))}
    </section>
  );
}
