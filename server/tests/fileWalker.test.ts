import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { collectTextFiles } from "../src/utils/fileWalker.js";
it("indexes example configuration but excludes live env files, npm credentials, and external symlinks", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "investigator-walker-"));
  try {
    const repo = path.join(root, "repo"); await fs.mkdir(repo);
    for (const name of [".env", ".env.local", ".env.production", ".env.production.json", ".npmrc", ".env.example", "index.ts"]) {
      await fs.writeFile(path.join(repo, name), "synthetic fixture");
    }
    await fs.writeFile(path.join(root,"outside.ts"), "outside scope");
    await fs.symlink(path.join(root,"outside.ts"), path.join(repo,"linked.ts"));
    const files = await collectTextFiles(repo);
    expect(files.map(file => file.relativePath).sort()).toEqual([".env.example", "index.ts"]);
  } finally { await fs.rm(root, {recursive: true, force: true}); }
});
