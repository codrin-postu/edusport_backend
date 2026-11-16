import * as React from 'react';
import { DataTable, Loading, Notice, Select, StatTile, type DataColumn } from '../../ui';
import { COMPETITII_COPY, scoreText, type AthleteCompetitions, type CompetitionLine } from '../../../club/sportivi/competitions-view';
import { isoToSlash } from '../../../club/date-format';
import type { SportiviApi } from './api';

const copy = COMPETITII_COPY;
const dash = '-';

/** "14/03/2026" from an ISO date; a line without a date shows nothing. */
const dateText = (iso: string | null): string => (iso ? isoToSlash(iso) ?? '' : '');
const num = (v: number | null): string => (v === null ? dash : String(v));

const COLUMNS: DataColumn<CompetitionLine>[] = [
  { key: 'date', header: copy.columns.date, render: (l) => dateText(l.date), width: '110px' },
  { key: 'name', header: copy.columns.name, render: (l) => l.name },
  { key: 'category', header: copy.columns.category, render: (l) => l.category ?? dash },
  { key: 'placement', header: copy.columns.placement, align: 'right', render: (l) => num(l.placement), width: '70px' },
  { key: 'score', header: copy.columns.score, align: 'right', render: (l) => scoreText(l.score), width: '90px' },
];

type State = { data: AthleteCompetitions | null; failed: boolean };

function useCompetitions(api: SportiviApi, documentId: string, season: string | null): State {
  const [state, setState] = React.useState<State>({ data: null, failed: false });
  React.useEffect(() => {
    let off = false;
    api.competitions(documentId, season)
      .then((data) => { if (!off) setState({ data, failed: false }); })
      .catch(() => { if (!off) setState((s) => ({ ...s, failed: true })); });
    return () => { off = true; };
  }, [api, documentId, season]);
  return state;
}

/** Competiții: four summary tiles, then the results newest first, with a season filter. Read on every opening. */
export function CompetitiiTab({ api, documentId }: { api: SportiviApi; documentId: string }) {
  const [season, setSeason] = React.useState<string | null>(null);
  const { data, failed } = useCompetitions(api, documentId, season);
  if (failed && !data) return <div className="ui-body"><Notice tone="danger">{copy.failed}</Notice></div>;
  if (!data) return <Loading />;
  if (!data.available) return <div className="ui-body"><Notice tone="danger">{copy.unavailable}</Notice></div>;
  const s = data.summary;
  return (
    <div className="ui-body spv-comp">
      <div className="ui-stats">
        <StatTile label={copy.tiles.competitions} value={s.competitions} />
        <StatTile label={copy.tiles.podiums} value={s.podiums} />
        <StatTile label={copy.tiles.bestPlacement} value={num(s.bestPlacement)} />
        <StatTile label={copy.tiles.bestScore} value={scoreText(s.bestScore)} />
      </div>
      {data.seasons.length > 0 && (
        <div className="spv-comp-bar">
          <Select
            className="spv-season" aria-label={copy.season} placeholder={copy.allSeasons} value={data.season ?? ''}
            options={data.seasons.map((v) => ({ value: v, label: v }))} onChange={(v) => setSeason(v || null)}
          />
        </div>
      )}
      <DataTable columns={COLUMNS} rows={data.lines} getRowKey={(l) => l.resultId ?? `${l.date}-${l.name}-${l.category}`} pageSize={0} empty={copy.empty} />
    </div>
  );
}
