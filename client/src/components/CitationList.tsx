export interface CitationView {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export function CitationList({ citations }: { citations: CitationView[] }) {
  return (
    <section className="citations" aria-label="Citations">
      <h4>Evidence</h4>
      {citations.length === 0 ? (
        <p className="subtle">No citations for this answer.</p>
      ) : (
        <ul>
          {citations.map((citation) => (
            <li key={citation.chunkId}>
              <span className="mono">{citation.filePath}</span>
              <span className="lines">
                L{citation.startLine}–{citation.endLine}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
