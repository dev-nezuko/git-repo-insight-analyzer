import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { ArchiveLimitError, readRepoArchive, type ArchiveLimits } from "../src/services/archive.js";

const ROOT = "octo-demo-1a2b3c/";
const LIMITS: ArchiveLimits = { maxFiles: 50, maxFileBytes: 1024, maxTotalBytes: 4096 };

function zipOf(files: Record<string, string | Buffer>, configure?: (zip: AdmZip) => void): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  configure?.(zip);
  return zip.toBuffer();
}

function paths(buffer: Buffer, limits = LIMITS): string[] {
  return readRepoArchive(buffer, limits)
    .files.map((file) => file.relativePath)
    .sort();
}

describe("readRepoArchive", () => {
  it("strips the zipball root folder and keeps indexable text files", () => {
    const archive = zipOf({
      [`${ROOT}README.md`]: "# demo",
      [`${ROOT}src/index.ts`]: "export const answer = 42;",
      [`${ROOT}Dockerfile`]: "FROM node:22"
    });
    expect(paths(archive)).toEqual(["Dockerfile", "README.md", "src/index.ts"]);
  });

  it("keeps paths as they are when the archive has no single wrapper folder", () => {
    const archive = zipOf({ "src/a.ts": "a", "lib/b.ts": "b" });
    expect(paths(archive)).toEqual(["lib/b.ts", "src/a.ts"]);
  });

  it("indexes the env example but never live env files or npm credentials", () => {
    const archive = zipOf({
      [`${ROOT}.env`]: "synthetic",
      [`${ROOT}.env.local`]: "synthetic",
      [`${ROOT}.env.production.json`]: "{}",
      [`${ROOT}.npmrc`]: "synthetic",
      [`${ROOT}.env.example`]: "PORT=4000",
      [`${ROOT}index.ts`]: "export {};"
    });
    expect(paths(archive)).toEqual([".env.example", "index.ts"]);
  });

  it("skips vendored and build directories", () => {
    const archive = zipOf({
      [`${ROOT}node_modules/pkg/index.js`]: "x",
      [`${ROOT}dist/bundle.js`]: "x",
      [`${ROOT}src/app.ts`]: "x"
    });
    expect(paths(archive)).toEqual(["src/app.ts"]);
  });

  it("drops entries that try to climb out of the repository", () => {
    const archive = zipOf({ [`${ROOT}src/ok.ts`]: "ok", [`${ROOT}x.ts`]: "x" }, (zip) => {
      const evil = zip.addFile(`${ROOT}placeholder.ts`, Buffer.from("escape"));
      evil.entryName = `${ROOT}../../etc/evil.ts`;
    });
    expect(paths(archive)).toEqual(["src/ok.ts", "x.ts"]);
  });

  it("ignores symlink entries instead of reading their targets", () => {
    const archive = zipOf({ [`${ROOT}real.ts`]: "real" }, (zip) => {
      const link = zip.addFile(`${ROOT}linked.ts`, Buffer.from("/etc/passwd"));
      link.attr = (0o120777 << 16) >>> 0;
    });
    expect(paths(archive)).toEqual(["real.ts"]);
  });

  it("skips binary and non-UTF-8 content", () => {
    const archive = zipOf({
      [`${ROOT}logo.svg`]: Buffer.from([0x3c, 0x00, 0x3e]),
      [`${ROOT}latin1.txt`]: Buffer.from([0x63, 0x61, 0x66, 0xe9]),
      [`${ROOT}plain.txt`]: "fine"
    });
    expect(paths(archive)).toEqual(["plain.txt"]);
  });

  it("skips single files above the per-file limit and counts them", () => {
    const archive = zipOf({ [`${ROOT}huge.json`]: "x".repeat(2048), [`${ROOT}small.json`]: "{}" });
    const result = readRepoArchive(archive, LIMITS);
    expect(result.files.map((file) => file.relativePath)).toEqual(["small.json"]);
    expect(result.skippedLarge).toBe(1);
  });

  it("refuses archives whose text exceeds the total limit, even when it compresses well", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 6; i += 1) files[`${ROOT}part${i}.txt`] = "a".repeat(1000);
    expect(() => readRepoArchive(zipOf(files), LIMITS)).toThrow(ArchiveLimitError);
  });

  it("refuses archives with more files than allowed", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 4; i += 1) files[`${ROOT}f${i}.ts`] = "x";
    expect(() => readRepoArchive(zipOf(files), { ...LIMITS, maxFiles: 3 })).toThrow(/more than 3/);
  });

  it("rejects data that is not a zip file", () => {
    expect(() => readRepoArchive(Buffer.from("<html>not a zip</html>"))).toThrow(ArchiveLimitError);
  });
});
