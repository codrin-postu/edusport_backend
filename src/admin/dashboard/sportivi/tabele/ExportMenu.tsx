import * as React from 'react';
import { Button, Popover, useMenuFocus } from '../../../ui';
import { IconChevronDown } from '../../../ui/icons';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { EXPORT_FORMATS } from '../../../../club/tables/shell-state';
import type { Format } from './api';

type Props = {
  /** The table can be downloaded (a view that opens, a result without an error). */
  canDownload: boolean; downloading: Format | null;
  onDownload: (format: Format) => void;
};

const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
    <path d="M7 2v7.5M3.8 6.6L7 9.8l3.2-3.2M2.5 12h9" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/** Split download: the button gives Excel, the arrow lists Excel and CSV of exactly what the table shows now. */
export function ExportMenu({ canDownload, downloading, onDownload }: Props) {
  const [open, setOpen] = React.useState(false);
  const arrow = React.useRef<HTMLButtonElement>(null);
  const menu = useMenuFocus(open, arrow, () => setOpen(false));
  const off = !canDownload || downloading !== null;
  const pick = (format: Format) => { setOpen(false); onDownload(format); };
  return (
    <span className="tbl-split">
      <Button icon={<IconDownload />} loading={downloading === 'xlsx'} disabled={off} onClick={() => onDownload(EXPORT_FORMATS[0].format)}>{TABLES_COPY.export.button}</Button>
      <Button
        ref={arrow} iconOnly icon={<IconChevronDown size={12} />} aria-label={TABLES_COPY.export.more}
        aria-haspopup="menu" aria-expanded={open} disabled={off} onClick={() => setOpen((o) => !o)}
      />
      <Popover
        open={open} anchorRef={arrow} onClose={menu.close} placement="bottom-end" className="spv-menu" role="menu"
        popoverRef={menu.popoverRef} popoverProps={menu.popoverProps}
      >
        {EXPORT_FORMATS.map((f) => <button key={f.format} type="button" role="menuitem" onClick={() => pick(f.format)}>{f.label}</button>)}
      </Popover>
    </span>
  );
}
