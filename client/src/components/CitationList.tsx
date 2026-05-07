export interface CitationView {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export function CitationList({ citations }: { citations: CitationView[] }) {
  if (citations.length === 0) {
    return <p>No citations.</p>;
  }

  return (
    <div>
      <strong>Citations</strong>
      <ul>
        {citations.map((citation) => (
          <li key={citation.chunkId}>
            {citation.filePath}:{citation.startLine}-{citation.endLine}
          </li>
        ))}
      </ul>
    </div>
  );
}
