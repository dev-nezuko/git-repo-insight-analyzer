export async function requestJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof payload?.message === "string" ? payload.message : `Request failed (${response.status}).`);
  }
  if (payload === null) throw new Error("The API returned an unreadable response.");
  return payload as T;
}
