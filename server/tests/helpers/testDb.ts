import { randomBytes } from "node:crypto";
import mongoose from "mongoose";

const BASE_URI = process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/codebase-investigator-test";

/** Connects mongoose to a throwaway database so test files can run in parallel. */
export async function connectTestDb(): Promise<void> {
  const url = new URL(BASE_URI);
  const baseName = url.pathname.slice(1) || "codebase-investigator-test";
  url.pathname = `/${baseName}-${randomBytes(4).toString("hex")}`;
  await mongoose.connect(url.toString(), { serverSelectionTimeoutMS: 5000 });
}

export async function dropTestDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}
