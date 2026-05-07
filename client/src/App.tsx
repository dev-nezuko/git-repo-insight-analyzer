import { useState, type FormEvent } from "react";
import { apiUrl } from "./apiBase";
import { requestJson } from "./requestJson";
import { ChatPanel } from "./components/ChatPanel";

interface ImportedRepo {
  label: string;
  sessionId: string;
  fileCount: number;
  chunkCount: number;
}

function repoLabel(url: string): string {
  return url.replace(/^https:\/\/(www\.)?github\.com\//i, "").replace(/(\.git)?\/?$/, "");
}

export default function App() {
  const [githubUrl, setGithubUrl] = useState("");
  const [repo, setRepo] = useState<ImportedRepo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const importRepo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = githubUrl.trim();
    if (loading || !url) return;
    setLoading(true);
    setError("");
    setRepo(null);
    try {
      const imported = await requestJson<{ repoId: string; fileCount: number; chunkCount: number }>(
        apiUrl("/api/repos/import"),
        { githubUrl: url }
      );
      const session = await requestJson<{ sessionId: string }>(apiUrl("/api/chat/sessions"), { repoId: imported.repoId });
      setRepo({ label: repoLabel(url), sessionId: session.sessionId, fileCount: imported.fileCount, chunkCount: imported.chunkCount });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="masthead">
        <p className="wordmark">Codebase Investigator</p>
        <h1>Find the code behind the answer.</h1>
        <p className="lede">
          Index a public GitHub repository, ask how it works, and read every answer next to the files and line ranges it
          rests on.
        </p>
      </header>

      <main className="workspace">
        <aside className="ledger" aria-labelledby="import-title">
          <h2 id="import-title">Repository</h2>
          <form onSubmit={importRepo} className="import-form">
            <label htmlFor="github-url">Public GitHub URL</label>
            <input
              id="github-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              required
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              disabled={loading}
              aria-describedby="import-hint"
            />
            <button type="submit" className="primary" disabled={loading || !githubUrl.trim()}>
              {loading ? "Indexing…" : "Import repository"}
            </button>
          </form>
          <p id="import-hint" className="hint">
            Downloads the default branch as a zip and indexes text files only. Nothing in the repository is executed.
          </p>

          <div aria-live="polite">
            {loading && <p className="status">Downloading the archive and splitting files into line ranges…</p>}
            {repo && (
              <dl className="repo-facts">
                <div>
                  <dt>Indexed</dt>
                  <dd className="mono">{repo.label}</dd>
                </div>
                <div>
                  <dt>Files</dt>
                  <dd>{repo.fileCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Chunks</dt>
                  <dd>{repo.chunkCount.toLocaleString()}</dd>
                </div>
              </dl>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}

          <section className="notes" aria-label="How answers are checked">
            <h3>How to read an answer</h3>
            <ul>
              <li>Citations point at 60-line chunks of the indexed files.</li>
              <li>The audit badge is a heuristic check on those citations, not proof of correctness.</li>
              <li>A stance note appears when an answer contradicts an earlier one in the session.</li>
            </ul>
          </section>
        </aside>

        {repo ? (
          <ChatPanel key={repo.sessionId} sessionId={repo.sessionId} repoLabel={repo.label} />
        ) : (
          <section className="investigation investigation--empty" aria-labelledby="empty-title">
            <h2 id="empty-title">No repository yet</h2>
            <p>Import a repository on the left, then ask a concrete question, for example:</p>
            <ul className="sample-questions">
              <li>Where does an API request enter the application?</li>
              <li>How is authentication handled?</li>
              <li>Which files define the data model?</li>
            </ul>
          </section>
        )}
      </main>

      <footer className="colophon">Local research prototype · Express, MongoDB and React</footer>
    </div>
  );
}
