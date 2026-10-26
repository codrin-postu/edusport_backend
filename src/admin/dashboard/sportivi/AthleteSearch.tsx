import * as React from 'react';
import { Input } from '../../ui';
import type { AthleteCard } from '../../../club/athletes/api-types';
import {
  SEARCH_COPY, cardSubline, noResultsText, showNewRow, withoutAthlete, type SearchResult,
} from '../../../club/sportivi/search-view';
import type { SportiviApi } from './api';

type Props = { api: SportiviApi; onPick: (card: AthleteCard) => void; onNew?: (text: string) => void; exclude?: string };

/** Server search 250 ms after the last key; the answer remembers its own text, so a late answer never mislabels. */
function useAthleteSearch(api: SportiviApi, text: string, exclude: string | undefined): SearchResult | null {
  const [result, setResult] = React.useState<SearchResult | null>(null);
  React.useEffect(() => {
    const q = text.trim();
    if (!q) {
      setResult(null);
      return undefined;
    }
    let off = false;
    const t = window.setTimeout(() => {
      api.search(q)
        .then((cards) => { if (!off) setResult({ q, cards: withoutAthlete(cards, exclude) }); })
        .catch(() => { if (!off) setResult(null); });
    }, 250);
    return () => { off = true; window.clearTimeout(t); };
  }, [api, text, exclude]);
  return result;
}

function ResultRow({ name, sub, onClick }: { name: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" className="spv-result" onClick={onClick}>
      <span className="spv-name">{name}</span>
      {sub ? <span className="spv-result-sub">{sub}</span> : null}
    </button>
  );
}

/** "Caută alt sportiv" (spec 4.1) for "Adaugă sportiv" (6.7) and the merge (6.6). */
export function AthleteSearch({ api, onPick, onNew, exclude }: Props) {
  const [text, setText] = React.useState('');
  const result = useAthleteSearch(api, text, exclude);
  return (
    <div className="spv-search">
      <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={SEARCH_COPY.placeholder} aria-label={SEARCH_COPY.placeholder} autoFocus />
      {result && result.cards.length > 0 && (
        <ul className="spv-results">
          {result.cards.map((c) => (
            <li key={c.documentId}>
              <ResultRow name={c.name} sub={cardSubline(c)} onClick={() => onPick(c)} />
            </li>
          ))}
        </ul>
      )}
      {result && result.cards.length === 0 && <p className="spv-muted">{noResultsText(result)}</p>}
      {onNew && result && showNewRow(result) && <ResultRow name={SEARCH_COPY.newAthlete} onClick={() => onNew(result.q)} />}
    </div>
  );
}
