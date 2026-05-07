// Question classifiers shared by retrieval, answer drafting and the auditor. Each pattern
// matches whole words, so "playlist" is not a request to list files and "framework" is
// not a behaviour question.

export function isStructureQuestion(question: string): boolean {
  return /\b(enumerate|list|top[\s-]?level|main entry|entry files?|folder structure|directory structure)\b/i.test(question);
}

export function isOverviewQuestion(question: string): boolean {
  return /\b(architecture|overview|top[\s-]?level|high[\s-]?level)\b|\b(repo|repository|project)\b.*\babout\b/i.test(question);
}

export function isBehaviorQuestion(question: string): boolean {
  return /\b(how|why|flows?|walk|through|works?|working|manages?|handl(e|es|ed|ing)|process(es|ed|ing)?|logic|change|improve|fix|explain|describe|risks?|risky|flag|feels|wrong|off|tell me)\b/i.test(
    question
  );
}

export function isDeadCodeQuestion(question: string): boolean {
  return /\b(dead code|unused|never used|unreachable|safe to (delete|remove))\b|\b(remove|delete)\b.*\bcode\b/i.test(question);
}

export function isServiceWalkthroughQuestion(question: string): boolean {
  return /\bwalk me through\b|\bwhat\b.*\bservice\b|\bthis service\b|\bservice does\b|\bskip the obvious\b/i.test(question);
}

export function isAuthQuestion(question: string): boolean {
  return /\b(auth|authenticat\w*|authoriz\w*|log ?in|logins?|log ?out|sign[\s-]?(up|in)|register\w*|tokens?|jwt|sessions?|passwords?|credentials?|oauth)\b/i.test(
    question
  );
}
