import * as React from 'react';
import { Loading, Notice, useIsPhone } from '../../ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PERIOD_COPY } from '../../../club/presence/copy/prezenta-ui';
import type { PeriodRow } from '../../../club/presence/attendance/api-types';
import { listDate } from '../../../club/presence/dates';
import { card, rowKey, targetOf, UNDONE_COLUMNS } from './GroupsList';
import { PeriodTable } from './PeriodTable';
import { SessionPanel, type SessionTarget } from './SessionPanel';

type Props = { rows: PeriodRow[] | null; failed: boolean };

/** "De completat" (spec 4.1): the held occurrences with no saved session, newest first; a row opens the session panel. */
export function UndoneTab({ rows, failed }: Props) {
  const phone = useIsPhone();
  const [opened, setOpened] = React.useState<SessionTarget | null>(null);
  if (failed) return <div className="pz-notices"><Notice tone="danger">{PRESENCE_ERRORS.loadFailed}</Notice></div>;
  if (rows === null) return <Loading />;
  return (
    <>
      {rows.length === 0 ? (
        <p className="pz-empty">{PERIOD_COPY.noUndone}</p>
      ) : (
        <PeriodTable
          groups={[{ key: 'undone', header: null, rows }]} columns={UNDONE_COLUMNS} phone={phone} getRowKey={rowKey} card={(r) => card(r, true)}
          onOpen={(r) => { const target = targetOf(r); if (target) setOpened(target); }}
          rowLabel={(r) => `${listDate(r.date)} ${r.startTime} ${r.groupName}`}
        />
      )}
      {opened && <SessionPanel key={JSON.stringify(opened)} target={opened} onClose={() => setOpened(null)} />}
    </>
  );
}
