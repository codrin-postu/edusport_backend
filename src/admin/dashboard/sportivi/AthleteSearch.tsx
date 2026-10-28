import * as React from 'react';
import { Input } from '../../ui';
import type { AthleteStatus } from '../../../club/athlete-data';
import type { AthleteCard } from '../../../club/athletes/api-types';
import {
  SEARCH_COPY, SEARCH_FAILED, cardSubline, movedOption, noResultsText, resultsText, showNewRow, withoutAthlete, type SearchResult,
} from '../../../club/sportivi/search-view';
import type { SportiviApi } from './api';

type Props = {
  api: Pick<SportiviApi, 'search'>;
  onPick: (card: AthleteCard) => void;
  onNew?: (text: string) => void;
  /** Athlete ids left out of the results. */
  exclude?: string | string[];
  /** Results with one of these statuses are left out (default: none). */
  hideStatus?: AthleteStatus[];
  inputRef?: React.Ref<HTMLInputElement>;
};
type Search = { result: SearchResult | null; failed: boolean };
type Option = { key: string; name: string; sub?: string; pick: () => void };

const IDLE: Search = { result: null, failed: false };

const visible = (cards: AthleteCard[], excludeKey: string, hideKey: string): AthleteCard[] =>
  withoutAthlete(cards, excludeKey ? excludeKey.split(',') : undefined).filter((c) => !hideKey.split(',').includes(c.status));

/** Server search 250 ms after the last key; the answer remembers its own text, so a late answer never mislabels. */
function useAthleteSearch(api: Props['api'], text: string, exclude: Props['exclude'], hideStatus: Props['hideStatus']): Search {
  const [search, setSearch] = React.useState<Search>(IDLE);
  const excludeKey = [exclude ?? []].flat().join(',');
  const hideKey = (hideStatus ?? []).join(',');
  React.useEffect(() => {
    const q = text.trim();
    if (!q) {
      setSearch(IDLE);
      return undefined;
    }
    let off = false;
    const t = window.setTimeout(() => {
      api.search(q)
        .then((cards) => { if (!off) setSearch({ result: { q, cards: visible(cards, excludeKey, hideKey) }, failed: false }); })
        .catch(() => { if (!off) setSearch({ result: null, failed: true }); });
    }, 250);
    return () => { off = true; window.clearTimeout(t); };
  }, [api, text, excludeKey, hideKey]);
  return search;
}

/** The found athletes, then "Sportiv nou" as the last option. */
function optionsOf(result: SearchResult | null, onPick: Props['onPick'], onNew: Props['onNew']): Option[] {
  if (!result) return [];
  const rows: Option[] = result.cards.map((c) => ({ key: c.documentId, name: c.name, sub: cardSubline(c), pick: () => onPick(c) }));
  return onNew && showNewRow(result) ? [...rows, { key: '', name: SEARCH_COPY.newAthlete, pick: () => onNew(result.q) }] : rows;
}

/** ArrowUp / ArrowDown / Home / End move, Enter picks, Escape drops the typed text (and so closes the list). */
function useOptionKeys(options: Option[], result: SearchResult | null, clear: () => void) {
  const [active, setActive] = React.useState(0);
  React.useEffect(() => setActive(0), [result]);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const next = movedOption(e.key, active, options.length);
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === 'Enter' && options[active] && result?.q === e.currentTarget.value.trim()) {
      e.preventDefault();
      options[active].pick();
    } else if (e.key === 'Escape' && e.currentTarget.value) {
      e.preventDefault();
      clear();
    }
  };
  return { active, setActive, onKeyDown };
}

type ListProps = { id: string; options: Option[]; active: number; onActive: (i: number) => void };

function OptionList({ id, options, active, onActive }: ListProps) {
  return (
    <ul className="spv-results" id={id} role="listbox" aria-label={SEARCH_COPY.placeholder}>
      {options.map((o, i) => (
        <li
          key={o.key}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          className="spv-result"
          data-active={i === active || undefined}
          onMouseEnter={() => onActive(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={o.pick}
        >
          <span className="spv-name">{o.name}</span>
          {o.sub ? <span className="spv-result-sub">{o.sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}

const statusText = ({ result, failed }: Search): string => (failed ? SEARCH_FAILED : result ? resultsText(result) : '');

/** "Caută alt sportiv" (spec 4.1) for "Adaugă sportiv" (6.7) and the merge (6.6), on the admin combobox pattern. */
export function AthleteSearch({ api, onPick, onNew, exclude, hideStatus, inputRef }: Props) {
  const [text, setText] = React.useState('');
  const search = useAthleteSearch(api, text, exclude, hideStatus);
  const { result, failed } = search;
  const options = optionsOf(result, onPick, onNew);
  const { active, setActive, onKeyDown } = useOptionKeys(options, result, () => setText(''));
  const listId = React.useId().replace(/:/g, '');
  const open = options.length > 0;
  return (
    <div className="spv-search">
      <Input
        ref={inputRef} type="search" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined} autoComplete="off" value={text} onKeyDown={onKeyDown}
        onChange={(e) => setText(e.target.value)} placeholder={SEARCH_COPY.placeholder} aria-label={SEARCH_COPY.placeholder} autoFocus
      />
      <span className="ui-sr" role="status" aria-live="polite">{statusText(search)}</span>
      {failed && <p className="ui-error">{SEARCH_FAILED}</p>}
      {result && result.cards.length === 0 && <p className="spv-muted">{noResultsText(result)}</p>}
      {open && <OptionList id={listId} options={options} active={active} onActive={setActive} />}
    </div>
  );
}
