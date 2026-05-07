import type { Claim } from "../types/investigator.js";

export function detectChangedStance(previousClaims: Claim[], newClaims: Claim[]): string | undefined {
  for (const current of newClaims) {
    for (const prior of previousClaims) {
      if (current.topicKey !== prior.topicKey) {
        continue;
      }
      const contradiction =
        (current.polarity === "negative" && prior.polarity === "positive") ||
        (current.polarity === "positive" && prior.polarity === "negative");
      if (contradiction) {
        return `Possible stance change on '${current.topicKey}': prior claim polarity was ${prior.polarity}, now ${current.polarity}.`;
      }
    }
  }
  return undefined;
}
