import { describe, expect, it } from "vitest";
import { isEntryCandidate, isToolingConfig } from "../src/utils/repoPaths.js";

describe("repository path roles", () => {
  it.each(["README.md", "package.json", "client/package.json", "src/main.ts", "server/src/index.ts", "vite.config.ts"])(
    "treats %s as an entry candidate",
    (filePath) => expect(isEntryCandidate(filePath)).toBe(true)
  );

  it.each(["src/domain.ts", "docs/readme-notes.md", "myvite.config.ts"])("does not treat %s as an entry candidate", (filePath) =>
    expect(isEntryCandidate(filePath)).toBe(false)
  );

  it("separates tooling config from source", () => {
    expect(isToolingConfig("tsconfig.build.json")).toBe(true);
    expect(isToolingConfig("client/.eslintrc")).toBe(true);
    expect(isToolingConfig("vitest.config.mjs")).toBe(true);
    expect(isToolingConfig("src/config/env.ts")).toBe(false);
  });
});
