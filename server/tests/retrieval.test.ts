import { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChunkModel } from "../src/models/Chunk.js";
import { retrieveRelevantChunks } from "../src/services/retrieval.js";
import { connectTestDb, dropTestDb } from "./helpers/testDb.js";

const repoId = new Types.ObjectId();

async function addChunk(filePath: string, content: string) {
  await ChunkModel.create({ repoId, filePath, startLine: 1, endLine: 20, content, contentHash: filePath });
}

beforeAll(async () => {
  await connectTestDb();
  await addChunk(
    "src/services/download.ts",
    "export async function downloadArchive(url, maxBytes) {\n  // enforce the archive size limit while streaming\n  if (received > maxBytes) throw new Error('archive size limit');\n}"
  );
  await addChunk(
    "tests/download.test.ts",
    "it('enforces the archive size limit', async () => {\n  await expect(downloadArchive(url, 10)).rejects.toThrow('archive size limit');\n});"
  );
  await addChunk("src/auth/login.ts", "export function login(password) {\n  return createSession(password);\n}");
});

afterAll(dropTestDb);

describe("retrieveRelevantChunks", () => {
  it("ranks the implementation above the test that repeats its words", async () => {
    const chunks = await retrieveRelevantChunks(String(repoId), "Where is the archive size limit enforced?");
    expect(chunks[0]?.filePath).toBe("src/services/download.ts");
  });

  it("does not demote tests when the question is about tests", async () => {
    const chunks = await retrieveRelevantChunks(String(repoId), "Which tests cover the archive size limit?");
    const score = (filePath: string) => chunks.find((chunk) => chunk.filePath === filePath)?.score;
    expect(score("tests/download.test.ts")).toBeGreaterThan(0);
    expect(score("tests/download.test.ts")).toBe(score("src/services/download.ts"));
  });

  it("only returns chunks from the requested repository", async () => {
    const chunks = await retrieveRelevantChunks(String(new Types.ObjectId()), "Where is the archive size limit enforced?");
    expect(chunks).toEqual([]);
  });
});
