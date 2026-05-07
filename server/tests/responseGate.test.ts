import { describe, expect, it } from "vitest";
import { applyAuditGate } from "../src/services/responseGate.js";

describe("audit gate", () => {
  it("adds warning text when verdict is fail for non-trivial answer", () => {
    const result = applyAuditGate("Base answer", true, "fail");
    expect(result).toContain("Audit gate: low trust result");
  });

  it("keeps answer untouched for pass verdict", () => {
    const result = applyAuditGate("Base answer", true, "pass");
    expect(result).toBe("Base answer");
  });
});
