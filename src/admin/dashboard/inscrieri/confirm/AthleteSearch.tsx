import * as React from 'react';
import { Input, Loading } from '../../../ui';
import type { AthleteCard } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY, INSCRIERI_PENDING_COPY } from '../../../../club/inscrieri-copy';
import { SEARCH_DEBOUNCE_MS, type WindowAction } from '../../../../club/inscrieri-confirm';
import { CLUB_URLS, cardDetailLine, initials } from '../../../../club/inscrieri-panel';
import { dataOf, useStableClient } from '../useClient';

export type SearchState = { cards: AthleteCard[] | null; failed: boolean };

/** GET /api/club/athletes/search (plan 3-2); without text: the registration's candidates, the proposed one first.
 * Loading again from the first key press: no old results, no "Niciun sportiv găsit" for text not searched yet. */
export function useAthleteSearch(registrationId: string | null, query: string): SearchState {
  const { get } = useStableClient();
  const [state, setState] = React.useState<SearchState>({ cards: null, failed: false });
  React.useEffect(() => {
    let off = false;
    setState({ cards: null, failed: false });
    const timer = window.setTimeout(() => {
      get(CLUB_URLS.athleteSearch(query.trim(), registrationId))
        .then((res) => {
          if (!off) setState({ cards: dataOf<AthleteCard[]>(res), failed: false });
        })
        .catch(() => {
          if (!off) setState({ cards: null, failed: true });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      off = true;
      window.clearTimeout(timer);
    };
  }, [get, registrationId, query]);
  return state;
}

type ListProps = { search: SearchState; query: string; onPick: (card: AthleteCard) => void; onNew: () => void };

function ResultRow({ card, onPick }: { card: AthleteCard; onPick: (card: AthleteCard) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onPick(card)}>
        <span className="ins-av">{initials(card.name)}</span>
        <span className="ins-res-t">
          <b>{card.name}</b>
          <span>{cardDetailLine(card)}</span>
        </span>
      </button>
    </li>
  );
}

/** Two-line rows (spec 4.1): the name, then birth date, last group and parent; nothing found: the line and "Sportiv nou". */
export function AthleteResultList({ search, query, onPick, onNew }: ListProps) {
  if (search.failed) return <p className="ins-empty">{INSCRIERI_PENDING_COPY.loadFailed}</p>;
  if (!search.cards) return <Loading />;
  const text = query.trim();
  const none = search.cards.length === 0;
  if (none && !text) return null;
  return (
    <ul className="ins-res">
      {search.cards.map((card) => (
        <ResultRow key={card.documentId} card={card} onPick={onPick} />
      ))}
      {none && <li className="ins-res-none">{CONFIRM_COPY.noResults(text)}</li>}
      {none && (
        <li>
          <button type="button" onClick={onNew}>
            <span className="ins-res-t">
              <b>{CONFIRM_COPY.newLabel}</b>
            </span>
          </button>
        </li>
      )}
    </ul>
  );
}

/** "Caută alt sportiv" replaces the cards in place (spec 4.1): no second window; "Anulează" goes back. */
export function AthleteSearch({ registrationId, query, dispatch }: { registrationId: string; query: string; dispatch: React.Dispatch<WindowAction> }) {
  const search = useAthleteSearch(registrationId, query);
  return (
    <div className="ins-search">
      <div className="ins-search-bar">
        <Input
          type="search"
          aria-label={CONFIRM_COPY.searchPlaceholder}
          placeholder={CONFIRM_COPY.searchPlaceholder}
          value={query}
          onChange={(e) => dispatch({ type: 'query', text: e.target.value })}
        />
        <button type="button" className="ins-link" onClick={() => dispatch({ type: 'closeSearch' })}>
          {CONFIRM_COPY.cancel}
        </button>
      </div>
      <AthleteResultList search={search} query={query} onPick={(card) => dispatch({ type: 'pick', card })} onNew={() => dispatch({ type: 'pickNew' })} />
    </div>
  );
}
