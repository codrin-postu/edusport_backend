import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterPanel, type FilterSection, Loading, Notice, useIsPhone } from '../../ui';
import { payFor } from '../../../club/bani/due-view';
import { athleteTabTo } from '../../../club/bani/routes';
import { restanteBlocks, restanteGroups, type RestanteSection } from '../../../club/bani/restante';
import { PRESENCE_ERRORS, noPriceListNotice } from '../../../club/presence/copy/core';
import { CONTABILITATE_COPY, MONEY_UI_COPY } from '../../../club/presence/copy/money-ui';
import { countWords } from '../../../club/ro-count';
import type { DuePage } from '../../../club/presence/money-api';
import type { PaymentFor } from '../../../club/presence/payments/rules';
import { useMoneyApi } from './api';
import { type ContabBodyProps } from './ContabBody';
import { PaymentWindow } from './PaymentWindow';
import { RestanteBlocks, type Actions } from './RestanteTab';
import { useLatest } from './latest';
import { useMoneyChanged } from './undo';

type Pay = { athlete: { id: string; name: string }; preselect: PaymentFor } | null;
const copy = CONTABILITATE_COPY.restante;

/** The month's page, reloaded after every money write. */
function useDue(month: string): { page: DuePage | null; failed: boolean } {
  const api = useMoneyApi();
  const [page, setPage] = React.useState<DuePage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const latest = useLatest();
  const reload = React.useCallback(async () => {
    const current = latest.next();
    try {
      const next = await api.due(month);
      if (!current()) return;
      setPage(next);
      setFailed(false);
    } catch {
      if (current()) setFailed(true);
    }
  }, [api, latest, month]);
  React.useEffect(() => { setPage(null); void reload(); }, [reload]);
  useMoneyChanged(() => void reload());
  return { page, failed };
}

const sectionOf = (v: string | null): RestanteSection => (v === 'scoala' || v === 'club' ? v : 'toate');

/** "Secțiune" and "Grupă": one choice each; "Toate" (nothing chosen) clears. */
function sections(section: RestanteSection, group: string | null, groups: string[]): FilterSection[] {
  const choices = Object.entries(copy.sectionOptions).filter(([value]) => value !== 'toate').map(([value, label]) => ({ value, label }));
  return [
    { key: 'section', label: copy.section, options: choices, selected: section === 'toate' ? [] : [section], single: true, allLabel: copy.sectionOptions.toate },
    { key: 'group', label: copy.group, options: groups.map((g) => ({ value: g, label: g })), selected: group !== null && groups.includes(group) ? [group] : [], single: true },
  ];
}

/** The Restanțe body (spec 5.2): what is still owed, Școala (month-independent) then Club (the month); filters `section` and `group` live in the URL. */
export function DeIncasatBody({ month, params, setParams }: ContabBodyProps) {
  const phone = useIsPhone();
  const navigate = useNavigate();
  const { page, failed } = useDue(month);
  const [pay, setPay] = React.useState<Pay>(null);
  const section = sectionOf(params.get('section'));
  const group = params.get('group') || null;
  const groups = React.useMemo(() => (page ? restanteGroups(page) : []), [page]);
  const a: Actions = {
    open: (r) => navigate(athleteTabTo(r.athleteId, 'plati')),
    pay: (r) => setPay({ athlete: { id: r.athleteId, name: r.athleteName }, preselect: payFor(r, month) }),
  };
  const change = (key: string, selected: string[]) => {
    const next = new URLSearchParams(params);
    if (selected[0]) next.set(key, selected[0]); else next.delete(key);
    setParams(next);
  };
  const blocks = page ? restanteBlocks(page, section, group) : [];
  const count = page ? countWords(blocks.reduce((n, b) => n + b.rows.length, 0), 'restanță', 'restanțe') : '';
  return (
    <>
      <div className="bn-toolbar">
        <FilterPanel sections={sections(section, group, groups)} onChange={change} onClearAll={() => setParams(new URLSearchParams())} totalLabel={count} showLabel={MONEY_UI_COPY.show(count)} />
      </div>
      {failed && <Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice>}
      {page && page.groupsWithoutList > 0 && <Notice tone="warning">{noPriceListNotice(page.groupsWithoutList)}</Notice>}
      {!page && !failed && <Loading />}
      {page && <RestanteBlocks blocks={blocks} phone={phone} a={a} />}
      {pay && <PaymentWindow mode="new" athlete={pay.athlete} preselect={pay.preselect} onClose={() => setPay(null)} />}
    </>
  );
}
