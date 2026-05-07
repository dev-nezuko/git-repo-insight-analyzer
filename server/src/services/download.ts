import { HttpError } from "../httpError.js";

export interface DownloadOptions {
  maxBytes: number;
  timeoutMs: number;
}

/**
 * Downloads a repository zipball into memory, refusing anything larger than `maxBytes`
 * whether or not the server sends a Content-Length. GitHub answers with a redirect to
 * codeload.github.com, which fetch follows.
 */
export async function downloadArchive(url: string, options: DownloadOptions): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "codebase-investigator", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(options.timeoutMs)
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new HttpError(502, timedOut ? "Timed out downloading the repository archive." : "Could not reach GitHub to download the repository.");
  }

  if (response.status === 404) {
    throw new HttpError(404, "Repository not found, or it is not public.");
  }
  if (response.status === 403 || response.status === 429) {
    throw new HttpError(503, "GitHub refused the download (rate limit). Try again later.");
  }
  if (!response.ok || !response.body) {
    throw new HttpError(502, `GitHub returned ${response.status} for the repository archive.`);
  }

  const tooLarge = () =>
    new HttpError(413, `Repository archive is larger than ${Math.round(options.maxBytes / (1024 * 1024))} MB.`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > options.maxBytes) {
    await response.body.cancel();
    throw tooLarge();
  }

  const parts: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      throw new HttpError(502, "The repository download was interrupted.");
    }
    if (chunk.done) break;
    received += chunk.value.byteLength;
    if (received > options.maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    parts.push(chunk.value);
  }
  return Buffer.concat(parts);
}
