import AdmZip from "adm-zip";
import { isIndexablePath } from "../utils/fileFilter.js";

export interface ArchiveLimits {
  /** Maximum number of files kept for indexing. */
  maxFiles: number;
  /** Files larger than this (uncompressed) are skipped rather than indexed. */
  maxFileBytes: number;
  /** Ceiling on the uncompressed bytes read across all kept files. */
  maxTotalBytes: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxFiles: 5000,
  maxFileBytes: 512 * 1024,
  maxTotalBytes: 64 * 1024 * 1024
};

export interface ArchiveFile {
  relativePath: string;
  content: string;
}

export interface ArchiveReadResult {
  files: ArchiveFile[];
  skippedLarge: number;
}

export class ArchiveLimitError extends Error {}

const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_REGULAR_FILE = 0o100000;

function isRegularFile(attr: number): boolean {
  const unixMode = (attr >>> 16) & UNIX_FILE_TYPE_MASK;
  // Archives written on Windows carry no unix mode; treat those entries as plain files.
  return unixMode === 0 || unixMode === UNIX_REGULAR_FILE;
}

/** GitHub zipballs wrap everything in one "<owner>-<repo>-<sha>/" folder; find it so it can be dropped. */
function sharedRootPrefix(entryNames: string[]): string {
  const first = entryNames[0] ?? "";
  const slash = first.indexOf("/");
  if (slash <= 0) return "";
  const prefix = first.slice(0, slash + 1);
  return entryNames.every((name) => name.startsWith(prefix)) ? prefix : "";
}

/**
 * Reads indexable text files straight from the archive buffer. Nothing is written to
 * disk, so traversal names and symlink entries cannot escape a target directory; they
 * are dropped along with binaries, oversized files and anything past the limits.
 */
export function readRepoArchive(buffer: Buffer, limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS): ArchiveReadResult {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ArchiveLimitError("The repository archive could not be read as a zip file.");
  }

  const files: ArchiveFile[] = [];
  let totalBytes = 0;
  let skippedLarge = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });

  const entries = zip.getEntries();
  const rootPrefix = sharedRootPrefix(entries.map((entry) => entry.entryName));

  for (const entry of entries) {
    if (entry.isDirectory || !isRegularFile(entry.attr)) continue;
    const relativePath = entry.entryName.slice(rootPrefix.length);
    if (!isIndexablePath(relativePath)) continue;

    if (entry.header.size > limits.maxFileBytes) {
      skippedLarge += 1;
      continue;
    }
    if (files.length >= limits.maxFiles) {
      throw new ArchiveLimitError(`Repository has more than ${limits.maxFiles} indexable files.`);
    }
    totalBytes += entry.header.size;
    if (totalBytes > limits.maxTotalBytes) {
      throw new ArchiveLimitError(
        `Repository text exceeds ${Math.round(limits.maxTotalBytes / (1024 * 1024))} MB uncompressed.`
      );
    }

    const data = entry.getData();
    if (data.length > limits.maxFileBytes || data.includes(0)) continue;
    let content: string;
    try {
      content = decoder.decode(data);
    } catch {
      continue;
    }
    files.push({ relativePath, content });
  }

  return { files, skippedLarge };
}
