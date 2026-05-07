import { afterEach, expect, it, vi } from "vitest";
import { requestJson } from "../../client/src/requestJson.js";
afterEach(() => vi.unstubAllGlobals());
it("rejects a failed API response instead of treating it as a successful import", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({message: "Repository unavailable"}), {status: 400})));
  await expect(requestJson("/api/repos/import", {})).rejects.toThrow("Repository unavailable");
});
it("gives a useful error when a failed proxy returns HTML", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", {status: 502})));
  await expect(requestJson("/api/repos/import", {})).rejects.toThrow("Request failed (502)");
});
it("returns successful API data", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({sessionId: "example"}))));
  await expect(requestJson("/api/chat/sessions", {})).resolves.toEqual({sessionId: "example"});
});
