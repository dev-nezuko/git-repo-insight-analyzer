import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { downloadArchive } from "../src/services/download.js";

let server: http.Server;
let base: string;
const OPTIONS = { maxBytes: 1000, timeoutMs: 2000 };

beforeAll(async () => {
  server = http.createServer((req, res) => {
    switch (req.url) {
      case "/ok":
        res.end(Buffer.alloc(500, 1));
        return;
      case "/redirect":
        res.writeHead(302, { Location: "/ok" }).end();
        return;
      case "/declared-large":
        res.writeHead(200, { "Content-Length": "5000" }).end(Buffer.alloc(5000));
        return;
      case "/streamed-large":
        res.writeHead(200);
        for (let i = 0; i < 20; i += 1) res.write(Buffer.alloc(100));
        res.end();
        return;
      case "/missing":
        res.writeHead(404).end();
        return;
      case "/limited":
        res.writeHead(403).end();
        return;
      default:
        res.writeHead(500).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("downloadArchive", () => {
  it("returns the body, following redirects", async () => {
    expect((await downloadArchive(`${base}/redirect`, OPTIONS)).length).toBe(500);
  });

  it("refuses a declared size over the limit without reading it", async () => {
    await expect(downloadArchive(`${base}/declared-large`, OPTIONS)).rejects.toMatchObject({ status: 413 });
  });

  it("stops a body without Content-Length once it passes the limit", async () => {
    await expect(downloadArchive(`${base}/streamed-large`, OPTIONS)).rejects.toMatchObject({ status: 413 });
  });

  it("reports a missing or private repository as 404", async () => {
    await expect(downloadArchive(`${base}/missing`, OPTIONS)).rejects.toMatchObject({ status: 404 });
  });

  it("reports a GitHub refusal as temporarily unavailable", async () => {
    await expect(downloadArchive(`${base}/limited`, OPTIONS)).rejects.toMatchObject({ status: 503 });
  });

  it("reports an unreachable host as a bad gateway", async () => {
    await expect(downloadArchive("http://127.0.0.1:1/zipball", OPTIONS)).rejects.toMatchObject({ status: 502 });
  });
});
