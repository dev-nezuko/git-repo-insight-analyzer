import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { requestJson } from "../requestJson";
import { apiUrl } from "../apiBase";
import { AuditBadge, type AuditView } from "./AuditBadge";
import { CitationList, type CitationView } from "./CitationList";

interface TurnView {
  id: string;
  question: string;
  answer: string;
  citations: CitationView[];
  audit: AuditView;
  changedStance?: string;
}

interface Props {
  sessionId: string;
  repoLabel: string;
}

const MIN_QUESTION = 5;
const SUGGESTIONS = [
  "Where does an API request enter the application?",
  "How is authentication handled?",
  "Which files define the data model?",
  "List the top-level folders and entry files"
];

export function ChatPanel({ sessionId, repoLabel }: Props) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<TurnView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestTurn = useRef<HTMLElement>(null);
  const ready = question.trim().length >= MIN_QUESTION && !loading;

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    latestTurn.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [turns.length]);

  const ask = async () => {
    if (!ready) return;
    const current = question.trim();
    setLoading(true);
    setError("");
    try {
      const payload = await requestJson<Omit<TurnView, "id" | "question"> & { turnId: string }>(
        apiUrl(`/api/chat/${sessionId}/ask`),
        { question: current }
      );
      setTurns((prev) => [...prev, { ...payload, id: payload.turnId, question: current }]);
      setQuestion("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not answer that question.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void ask();
    }
  };

  return (
    <section className="investigation" aria-labelledby="investigation-title" aria-busy={loading}>
      <div className="investigation__head">
        <h2 id="investigation-title">Investigation</h2>
        <span className="mono subtle">{repoLabel}</span>
      </div>

      {turns.length === 0 && !loading && (
        <div className="suggestions">
          <p>Start with one of these, or write your own:</p>
          <div className="chips">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="chip" onClick={() => setQuestion(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <ol className="turns">
        {turns.map((turn, index) => (
          <li key={turn.id}>
            <article className="turn" ref={index === turns.length - 1 ? latestTurn : undefined} aria-label={`Answer ${index + 1}`}>
              <h3 className="turn__question">{turn.question}</h3>
              <div className="turn__answer">{turn.answer}</div>
              {turn.changedStance && (
                <p className="stance" role="note">
                  <strong>Stance check:</strong> {turn.changedStance}
                </p>
              )}
              <div className="turn__evidence">
                <CitationList citations={turn.citations} />
                <AuditBadge audit={turn.audit} />
              </div>
            </article>
          </li>
        ))}
      </ol>

      {loading && (
        <p className="status" role="status">
          Ranking chunks and checking citations…
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form className="ask-form" onSubmit={onSubmit}>
        <label htmlFor="question">Your question</label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          maxLength={2000}
          placeholder="Ask about behaviour, data flow, risky code or what is safe to delete…"
          aria-describedby="question-hint"
        />
        <div className="ask-form__row">
          <span id="question-hint" className="hint">
            At least {MIN_QUESTION} characters. Ctrl or ⌘ + Enter sends.
          </span>
          <button type="submit" className="primary" disabled={!ready}>
            {loading ? "Investigating…" : "Ask"}
          </button>
        </div>
      </form>
    </section>
  );
}
