import * as React from 'react';
import { Button, Popover, StatTile, adminToast } from '../../ui';
import { BANI_COPY } from '../../../club/presence/copy/money-ui';
import { PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { ron } from '../../../club/presence/money';
import type { Accounting } from '../../../club/money/accounting';
import { useMenuFocus } from '../../ui';
import { blobErrorText, downloadGet } from '../inscrieri/downloadPdf';
import { useAuth } from '@strapi/admin/strapi-admin';
import { strapiDownload } from '../inscrieri/strapiDownload';

type Format = 'xlsx' | 'csv';
const FORMATS: { value: Format; label: string }[] = [{ value: 'xlsx', label: BANI_COPY.xlsx }, { value: 'csv', label: BANI_COPY.csv }];

/** "Export contabil": .xlsx or .csv of the month. A refusal (the .xlsx answer 501 until the library lands) shows the server's message as a toast. */
function ExportMenu({ month }: { month: string }) {
  const token = useAuth('BaniDownload', (state) => state.token) ?? null;
  const ref = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const menu = useMenuFocus(open, ref, () => setOpen(false));
  const [busy, setBusy] = React.useState(false);
  const pick = async (format: Format) => {
    setOpen(false);
    setBusy(true);
    try {
      await downloadGet(token, `/api/club/money/accounting.${format}?month=${month}`, `contabil-${month}.${format}`, strapiDownload());
    } catch (err) {
      adminToast.error(await blobErrorText(err, PRESENCE_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button ref={ref} size="sm" variant="secondary" aria-haspopup="true" aria-expanded={open} disabled={busy} onClick={() => setOpen((o) => !o)}>{BANI_COPY.exportBtn}</Button>
      <Popover open={open} anchorRef={ref} onClose={menu.close} placement="bottom-end" className="bn-pop" role="menu" popoverRef={menu.popoverRef} popoverProps={menu.popoverProps}>
        {FORMATS.map((f) => <button key={f.value} type="button" role="menuitem" onClick={() => void pick(f.value)}>{f.label}</button>)}
      </Popover>
    </>
  );
}

/** Pe grupe, second part (spec 5.5): the export and four figures; the month's payments are the Plăți tab. */
export function BaniAccounting({ data, month }: { data: Accounting; month: string }) {
  const f = BANI_COPY.figures;
  const figures: [string, number][] = [[f.numerar, data.byMethod.numerar], [f.card, data.byMethod.card], [f.transfer, data.byMethod.transfer], [f.cancelled, data.byMethod.cancelled]];
  return (
    <>
      <div className="bn-head"><ExportMenu month={month} /></div>
      <div className="bn-figures">{figures.map(([label, v]) => <StatTile key={label} label={label} value={ron(v)} />)}</div>
    </>
  );
}
