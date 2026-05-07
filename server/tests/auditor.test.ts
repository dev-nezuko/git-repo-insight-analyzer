import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ChunkModel } from "../src/models/Chunk.js";
import { runAudit } from "../src/services/auditor.js";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("auditor citation checks", () => {
  it("flags hallucination when citation chunk does not exist", async () => {
    const result = await runAudit(
      "How does auth work?",
      "Auth flow is definitely robust.",
      [
        {
          chunkId: "507f1f77bcf86cd799439011",
          filePath: "src/auth.ts",
          startLine: 1,
          endLine: 10
        }
      ]
    );

    expect(result.checks.citationIntegrity).toBe(false);
    expect(result.issues.some((issue) => issue.type === "hallucination")).toBe(true);
  });

  it("passes citation integrity for valid chunk references", async () => {
    const chunk = await ChunkModel.create({
      repoId: new mongoose.Types.ObjectId(),
      filePath: "src/auth.ts",
      startLine: 3,
      endLine: 15,
      content: "export async function signup() { return true; }",
      contentHash: "abc123",
      embedding: []
    });

    const result = await runAudit(
      "How does signup work?",
      "Evidence points at signup handling in the auth service.",
      [
        {
          chunkId: String(chunk._id),
          filePath: "src/auth.ts",
          startLine: 3,
          endLine: 15
        }
      ]
    );

    expect(result.checks.citationIntegrity).toBe(true);
  });
});
