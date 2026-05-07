import { describe, expect, it } from "vitest";
import { detectChangedStance } from "../src/services/claimLedger.js";

describe("claim ledger contradiction detection", () => {
  it("returns note when polarity flips for same topic", () => {
    const changed = detectChangedStance(
      [
        {
          id: "c1",
          text: "Auth is safe.",
          topicKey: "auth_flow",
          polarity: "positive",
          citations: []
        }
      ],
      [
        {
          id: "c2",
          text: "Auth is unsafe due to missing checks.",
          topicKey: "auth_flow",
          polarity: "negative",
          citations: []
        }
      ]
    );

    expect(changed).toContain("Possible stance change");
  });
});
