import * as React from 'react';
import { cx } from './cx';

export interface PagerProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** With pageSize, shows "26 - 50 din 120". */
  total?: number;
  pageSize?: number;
  className?: string;
}

/** Page numbers 1, current +-1, last, with gaps; plus previous / next. */
export function pageList(page: number, pageCount: number): number[] {
  const out: number[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p !== 1 && p !== pageCount && Math.abs(p - page) > 1) continue;
    if (out.length && p - out[out.length - 1] > 1) out.push(-1);
    out.push(p);
  }
  return out;
}

export function Pager({ page, pageCount, onChange, total, pageSize, className }: PagerProps) {
  const pages = pageList(page, Math.max(1, pageCount));
  const range =
    total !== undefined && pageSize
      ? `${total === 0 ? 0 : (page - 1) * pageSize + 1} - ${Math.min(total, page * pageSize)} din ${total}`
      : null;
  return (
    <nav className={cx('ui-pager', className)} aria-label="Paginare">
      {range && <span className="ui-num ui-pager-range">{range}</span>}
      <span className="ui-pager-pages">
        <button type="button" className="ui-pg" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Pagina anterioară">
          ‹
        </button>
        {pages.map((p, i) =>
          p === -1 ? (
            <span key={`gap-${i}`} className="ui-pg-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="ui-pg ui-num"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="ui-pg"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          aria-label="Pagina următoare"
        >
          ›
        </button>
      </span>
    </nav>
  );
}

export default Pager;
