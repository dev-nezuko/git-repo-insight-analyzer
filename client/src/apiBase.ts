/**
 * Same-origin on Vercel (prod): paths like `/api/...`.
 * Override with VITE_API_URL when API is hosted on another domain.
 */
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
