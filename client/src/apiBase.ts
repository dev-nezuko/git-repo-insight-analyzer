/** Production (same-origin): paths like `/api/...`. Use VITE_API_URL when the API is on another domain. */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "http://localhost:4000";
  }
  return "";
}

/** Join base with an API path (`/api/...`). */
export function apiUrl(pathSuffix: string): string {
  const p = pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`;
  const b = apiBase();
  return b ? `${b}${p}` : p;
}
