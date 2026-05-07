import { useState, type FormEvent } from "react";
import { apiUrl } from "./apiBase";
import { requestJson } from "./requestJson";
import { ChatPanel } from "./components/ChatPanel";

export default function App() {
  const [githubUrl, setGithubUrl] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const importRepo = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || !githubUrl.trim()) return;
    setLoading(true); setError(""); setSessionId(null);
    setStatus("Downloading and indexing the public repository…");
    try {
      const imported = await requestJson<{repoId: string; fileCount: number; chunkCount: number}>(apiUrl("/api/repos/import"), {githubUrl: githubUrl.trim()});
      const session = await requestJson<{sessionId: string}>(apiUrl("/api/chat/sessions"), {repoId: imported.repoId});
      setSessionId(session.sessionId);
      setStatus(`Ready · ${imported.fileCount} files · ${imported.chunkCount} indexed chunks`);
    } catch (failure) {
      setStatus("");
      setError(failure instanceof Error ? failure.message : "Import failed. Please try again.");
    } finally { setLoading(false); }
  };
  return <main>
    <header><span className="eyebrow">REPOSITORY RESEARCH WORKSPACE</span>
      <h1>Find the code behind<br />the answer.</h1>
      <p>Explore a public GitHub repository with source references, follow-up questions, and heuristic checks on each answer.</p>
      <div className="feature-row"><span>File + line citations</span><span>Session history</span><span>Optional AI synthesis</span></div>
    </header>
    <section className="import-panel" aria-labelledby="import-title">
      <h2 id="import-title">Start with a public repository</h2>
      <form onSubmit={importRepo}>
        <label htmlFor="github-url">GitHub repository URL</label>
        <div className="input-row"><input id="github-url" type="url" required value={githubUrl} onChange={e => setGithubUrl(e.target.value)} placeholder="https://github.com/owner/repository" disabled={loading} />
          <button disabled={loading || !githubUrl.trim()}>{loading ? "Importing…" : "Import repository"}</button></div>
      </form>
      <p className="hint">Imports a source snapshot, not Git history. MongoDB and a running API are required. Repository code is indexed as text, never run.</p>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
    {sessionId ? <ChatPanel key={sessionId} sessionId={sessionId} /> : <section className="empty-state">
      <span className="step">AFTER IMPORT</span><h2>Ask a question. Inspect the evidence.</h2>
      <div className="question-grid"><p>“Where does the request enter the application?”</p><p>“How is authentication handled?”</p><p>“Which files define the data model?”</p></div>
      <p className="hint">Answers use lexical retrieval and optional model synthesis. An audit badge is a heuristic signal, not a guarantee of accuracy or security.</p>
    </section>}
    <footer>Codebase Investigator · MERN + TypeScript · Local research prototype</footer>
  </main>;
}
