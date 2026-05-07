import type { AddressInfo } from "node:net";
import type http from "node:http";
import { afterAll, beforeAll, expect, it } from "vitest";
import { connectTestDb, dropTestDb } from "./helpers/testDb.js";

let server: http.Server;
let api: string;

beforeAll(async () => {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:1/unreachable?serverSelectionTimeoutMS=300";
  const { createApp } = await import("../src/app.js");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await dropTestDb();
});

it("stays live without a database and recovers once one is connected", async () => {
  expect((await fetch(`${api}/health`)).status).toBe(200);
  expect((await fetch(`${api}/api/repos/507f1f77bcf86cd799439011`)).status).toBe(503);

  await connectTestDb();
  expect((await fetch(`${api}/api/repos/507f1f77bcf86cd799439011`)).status).toBe(404);
});
