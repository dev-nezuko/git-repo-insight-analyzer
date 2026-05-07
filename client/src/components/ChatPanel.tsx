import { useState, type ChangeEvent } from "react";
import { requestJson } from "../requestJson";
import { apiUrl } from "../apiBase";
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

  const [error, setError] = useState("");

  const ask = async () => {
    if (loading || question.trim().length < 5) {
      return;
    }
    setLoading(true); setError("");
    const current = question.trim();
    try {
      const payload = await requestJson<Omit<TurnView, "id" | "question"> & {turnId: string}>(apiUrl(`/api/chat/${sessionId}/ask`), {question: current});
      setTurns(prev => [...prev, { ...payload, id: payload.turnId, question: current }]);
      setQuestion("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not answer that question.");
    } finally { setLoading(false); }
  };

  return (
    <section className="chat-panel">
      <h2>Investigation Chat</h2>
      <label htmlFor="question">Your question (at least 5 characters)</label>
      <textarea id="question"
        value={question}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQuestion(e.target.value)}
        rows={3}
        placeholder="Ask about code behavior, risk, dead code, async usage..."
      />
      <br />
      <button onClick={ask} disabled={loading || question.trim().length < 5}>
        {loading ? "Investigating..." : "Ask"}
      </button>

      {error && <p role="alert" className="error">{error}</p>}
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
