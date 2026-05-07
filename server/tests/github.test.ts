import { describe, expect, it } from "vitest";
import { HttpError } from "../src/httpError.js";
import { parseGithubUrl } from "../src/utils/github.js";

describe("parseGithubUrl", () => {
  it.each([
    ["https://github.com/octo-org/demo", "octo-org", "demo"],
    ["https://github.com/octo-org/demo.git", "octo-org", "demo"],
    ["https://github.com/octo-org/demo/", "octo-org", "demo"],
    ["  https://www.github.com/Octo-Org/My.Repo_2  ", "Octo-Org", "My.Repo_2"]
  ])("accepts %s", (url, owner, repo) => {
    expect(parseGithubUrl(url)).toMatchObject({ owner, repo });
  });

  it("gives differently spelled URLs of one repository the same identity", () => {
    const a = parseGithubUrl("https://github.com/Octo-Org/Demo.git");
    const b = parseGithubUrl("https://github.com/octo-org/demo/");
    expect(a.canonicalUrl).toBe("https://github.com/octo-org/demo");
    expect(b.canonicalUrl).toBe(a.canonicalUrl);
  });

  it.each([
    "http://github.com/octo-org/demo",
    "https://gitlab.com/octo-org/demo",
    "https://github.com.evil.test/octo-org/demo",
    "https://github.com/octo-org",
    "https://github.com/octo-org/demo/tree/main",
    "https://github.com/octo-org/..",
    "https://github.com/../demo",
    "https://github.com/octo-org/demo?ref=x",
    "https://github.com/octo-org/demo#readme",
    "https://github.com/octo-org/de%2Fmo",
    "https://github.com/octo org/demo"
  ])("rejects %s with a 400", (url) => {
    expect(() => parseGithubUrl(url)).toThrow(HttpError);
    try {
      parseGithubUrl(url);
    } catch (error) {
      expect((error as HttpError).status).toBe(400);
    }
  });
});
