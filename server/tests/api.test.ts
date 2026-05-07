import http from "node:http";
import type { AddressInfo } from "node:net";
import AdmZip from "adm-zip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectTestDb, dropTestDb } from "./helpers/testDb.js";

const ALLOWED_ORIGIN = "http://localhost:5173";
let archiveServer: http.Server;
let apiServer: http.Server;
let api: string;

function demoArchive(): Buffer {
  const zip = new AdmZip();
  const files: Record<string, string> = {
    "README.md": "# Demo shop\n\nA small storefront API used as a test fixture.",
    "package.json": JSON.stringify({ name: "demo-shop", main: "src/index.ts" }),
    "src/index.ts": "import { startServer } from './server';\n\nstartServer(3000);\n",
    "src/server.ts":
      "export function startServer(port: number) {\n  // request entry point for every HTTP call\n  return port;\n}\n",
    "src/auth/login.ts":
      "export async function login(email: string, password: string) {\n  const session = await createSession(email, password);\n  return session.token;\n}\n",
    ".env": "SYNTHETIC_SECRET=never-indexed"
  };
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(`octo-org-demo-1a2b3c/${name}`, Buffer.from(content));
  }
  return zip.toBuffer();
}

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : undefined };
}

async function importDemo(url = "https://github.com/octo-org/demo") {
  return call("POST", "/api/repos/import", { githubUrl: url });
}

beforeAll(async () => {
  archiveServer = http.createServer((req, res) => {
    // GitHub resolves owner and repository names case-insensitively.
    const url = req.url?.toLowerCase();
    if (url === "/repos/octo-org/demo/zipball") {
      res.writeHead(200, { "Content-Type": "application/zip" }).end(demoArchive());
    } else if (url === "/repos/octo-org/huge/zipball") {
      res.writeHead(200, { "Content-Length": String(2 * 1024 * 1024) }).end(Buffer.alloc(2 * 1024 * 1024));
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => archiveServer.listen(0, "127.0.0.1", resolve));

  Object.assign(process.env, {
    GITHUB_API_URL: `http://127.0.0.1:${(archiveServer.address() as AddressInfo).port}`,
    IMPORT_MAX_ARCHIVE_MB: "1",
    CORS_ORIGINS: ALLOWED_ORIGIN,
    OPENAI_API_KEY: "",
    AWS_ACCESS_KEY_ID: ""
  });
  await connectTestDb();
  const { createApp } = await import("../src/app.js");
  apiServer = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => apiServer.once("listening", resolve));
  api = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => apiServer.close(resolve));
  await new Promise((resolve) => archiveServer.close(resolve));
  await dropTestDb();
});

describe("repository import", () => {
  it("indexes the archive and reports counts, leaving the live .env out", async () => {
    const imported = await importDemo();
    expect(imported.status).toBe(201);
    expect(imported.body).toMatchObject({ fileCount: 5 });
    expect(imported.body.chunkCount).toBeGreaterThanOrEqual(5);

    const repo = await call("GET", `/api/repos/${imported.body.repoId}`);
    expect(repo.body).toMatchObject({ status: "ready", owner: "octo-org", name: "demo" });
  });

  it("treats another spelling of the same URL as the same repository", async () => {
    const first = await importDemo();
    const second = await importDemo("https://github.com/Octo-Org/Demo.git/");
    expect(second.body.repoId).toBe(first.body.repoId);
  });

  it("rejects a URL that is not a plain GitHub repository", async () => {
    const response = await importDemo("https://github.com/octo-org/..");
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Invalid GitHub URL/);
  });

  it("returns 404 for a repository GitHub does not serve, and marks it failed", async () => {
    const response = await importDemo("https://github.com/octo-org/missing");
    expect(response.status).toBe(404);

    const { RepoModel } = await import("../src/models/Repo.js");
    const repo = await RepoModel.findOne({ githubUrl: "https://github.com/octo-org/missing" }).lean();
    expect(repo?.status).toBe("failed");
    const session = await call("POST", "/api/chat/sessions", { repoId: String(repo?._id) });
    expect(session.status).toBe(409);
  });

  it("refuses an archive over the configured size", async () => {
    const response = await importDemo("https://github.com/octo-org/huge");
    expect(response.status).toBe(413);
  });

  it("rejects a malformed JSON body with 400", async () => {
    const response = await call("POST", "/api/repos/import", "{not json");
    expect(response.status).toBe(400);
  });
});

describe("sessions and questions", () => {
  it("answers with citations that point at indexed files, and keeps history", async () => {
    const { body: imported } = await importDemo();
    const session = await call("POST", "/api/chat/sessions", { repoId: imported.repoId });
    expect(session.status).toBe(201);

    const asked = await call("POST", `/api/chat/${session.body.sessionId}/ask`, {
      question: "How does login create a session?"
    });
    expect(asked.status).toBe(201);
    expect(asked.body.citations.length).toBeGreaterThan(0);
    expect(asked.body.citations.map((c: { filePath: string }) => c.filePath)).toContain("src/auth/login.ts");
    expect(asked.body.audit.checks.citationIntegrity).toBe(true);

    const history = await call("GET", `/api/chat/${session.body.sessionId}/history`);
    expect(history.body.turns).toHaveLength(1);
  });

  it.each(["not-an-id", "507f1f77bcf86cd799439011"])("returns 404 for unknown repo id %s", async (repoId) => {
    expect((await call("POST", "/api/chat/sessions", { repoId })).status).toBe(404);
    expect((await call("GET", `/api/repos/${repoId}`)).status).toBe(404);
  });

  it.each(["not-an-id", "507f1f77bcf86cd799439011"])("returns 404 for unknown session %s", async (sessionId) => {
    expect((await call("POST", `/api/chat/${sessionId}/ask`, { question: "Where is login?" })).status).toBe(404);
    expect((await call("GET", `/api/chat/${sessionId}/history`)).status).toBe(404);
  });

  it("explains a question that is too short", async () => {
    const response = await call("POST", "/api/chat/507f1f77bcf86cd799439011/ask", { question: "hi" });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/^Invalid request\. question:/);
  });
});

describe("cross-origin access", () => {
  it("allows the configured UI origin and no other", async () => {
    const allowed = await call("GET", "/health", undefined, { Origin: ALLOWED_ORIGIN });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    const other = await call("GET", "/health", undefined, { Origin: "https://attacker.example" });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });
});
