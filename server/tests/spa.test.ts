import fs from "node:fs/promises";
import type http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { connectTestDb, dropTestDb } from "./helpers/testDb.js";

let webRoot: string;
let server: http.Server;
let base: string;

beforeAll(async () => {
  webRoot = await fs.mkdtemp(path.join(os.tmpdir(), "investigator-web-"));
  await fs.writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>spa shell</title>");
  await fs.writeFile(path.join(webRoot, "app.js"), "console.log('bundle')");
  await connectTestDb();
  const { createApp } = await import("../src/app.js");
  server = createApp(webRoot).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(webRoot, { recursive: true, force: true });
  await dropTestDb();
});

it("serves built assets and falls back to index.html for client routes", async () => {
  expect(await (await fetch(`${base}/app.js`)).text()).toContain("bundle");
  const deepLink = await fetch(`${base}/sessions/abc`);
  expect(deepLink.headers.get("content-type")).toMatch(/text\/html/);
  expect(await deepLink.text()).toContain("spa shell");
});

it("keeps unknown API paths as JSON 404s", async () => {
  const response = await fetch(`${base}/api/nope`);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ message: "Not found" });
});
