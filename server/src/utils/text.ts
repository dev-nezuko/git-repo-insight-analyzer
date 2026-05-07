const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "this", "that", "is",
  "are", "be", "as", "at", "it", "by", "from", "we", "you", "they", "he", "she", "i",
  "how", "what", "why", "where", "when", "which", "here", "there", "about", "would", "could",
  "should", "do", "does", "did", "can", "any"
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function scoreOverlap(query: string, content: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return 0;
  }
  const contentSet = new Set(tokenize(content));
  let score = 0;
  for (const token of queryTokens) {
    if (contentSet.has(token)) {
      score += 1;
    }
  }
  return score / queryTokens.length;
}

export function topicKeyFromText(text: string): string {
  return tokenize(text).slice(0, 6).join("_");
}
