import { HttpError } from "../httpError.js";

// GitHub owner names: up to 39 alphanumerics or hyphens. Repository names: letters,
// digits, ".", "_" and "-". Anything else (query strings, "..", encoded slashes) is refused
// before it reaches the archive URL.
const GITHUB_URL_REGEX =
  /^https:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/i;

export interface GithubRepoRef {
  owner: string;
  repo: string;
  /** Lower-cased https://github.com/owner/repo, used as the stored identity. */
  canonicalUrl: string;
}

export function parseGithubUrl(url: string): GithubRepoRef {
  const match = url.trim().match(GITHUB_URL_REGEX);
  const owner = match?.[1];
  const repo = match?.[2];
  if (!owner || !repo || /^\.+$/.test(repo)) {
    throw new HttpError(400, "Invalid GitHub URL. Expected https://github.com/owner/repo");
  }
  return { owner, repo, canonicalUrl: `https://github.com/${owner}/${repo}`.toLowerCase() };
}
