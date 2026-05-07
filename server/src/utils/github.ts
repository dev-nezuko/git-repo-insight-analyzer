const GITHUB_URL_REGEX = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

export function parseGithubUrl(url: string): { owner: string; repo: string } {
  const clean = url.trim();
  const match = clean.match(GITHUB_URL_REGEX);
  if (!match) {
    throw new Error("Invalid GitHub URL. Expected https://github.com/owner/repo");
  }
  return { owner: match[1], repo: match[2] };
}
