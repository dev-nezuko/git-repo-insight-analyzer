import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RetrievedChunk } from "../src/services/retrieval.js";

const CHUNKS: RetrievedChunk[] = [
  { chunkId: "c1", filePath: "src/auth/login.ts", startLine: 1, endLine: 4, content: "export function login() {}", score: 1 }
];

let synthesizeWithAi: typeof import("../src/services/aiSynthesizer.js").synthesizeWithAi;

beforeAll(async () => {
  // A placeholder key: fetch is stubbed in every test, so nothing reaches a provider.
  process.env.OPENAI_API_KEY = "test-placeholder";
  process.env.AWS_ACCESS_KEY_ID = "";
  ({ synthesizeWithAi } = await import("../src/services/aiSynthesizer.js"));
});

afterEach(() => vi.unstubAllGlobals());

describe("synthesizeWithAi", () => {
  it("sends the shared prompt with the evidence and returns the model text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "  Login lives in src/auth/login.ts.  " } }] }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const answer = await synthesizeWithAi("How does login work?", CHUNKS, "Top-level directories: src");
    expect(answer).toBe("Login lives in src/auth/login.ts.");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.messages[0].content).toMatch(/Use ONLY the provided snippets/);
    expect(body.messages[1].content).toContain("[1] src/auth/login.ts:1-4");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back (undefined) when the provider errors or times out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 503 })));
    expect(await synthesizeWithAi("How does login work?", CHUNKS)).toBeUndefined();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));
    expect(await synthesizeWithAi("How does login work?", CHUNKS)).toBeUndefined();
  });

  it("does not call a provider without evidence", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await synthesizeWithAi("How does login work?", [])).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
