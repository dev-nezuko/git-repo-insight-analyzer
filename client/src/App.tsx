import { useState } from "react";
import { ChatPanel } from "./components/ChatPanel";

export default function App() {
  const [githubUrl, setGithubUrl] = useState("");
  const [repoId, setRepoId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const importRepo = async () => {
    setStatus("Importing repository...");
    const response = await fetch("http://localhost:4000/api/repos/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubUrl })
    });
    const payload = await response.json();
    setRepoId(payload.repoId);
    setStatus(`Indexed ${payload.fileCount} files and ${payload.chunkCount} chunks.`);

    const sessionResponse = await fetch("http://localhost:4000/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId: payload.repoId })
    });
    const sessionPayload = await sessionResponse.json();
    setSessionId(sessionPayload.sessionId);
  };

  return (
    <main>
      <h1>Codebase Investigator</h1>
      <p>Paste a public GitHub repository URL and ask code questions with citations + independent audit.</p>
      <input
        value={githubUrl}
        onChange={(e) => setGithubUrl(e.target.value)}
        placeholder="https://github.com/owner/repo"
      />
      <button onClick={importRepo}>Import Repo</button>
      <p>{status}</p>
      {repoId && <p>Repo ID: {repoId}</p>}
      {sessionId && <ChatPanel sessionId={sessionId} />}
    </main>
  );
}
