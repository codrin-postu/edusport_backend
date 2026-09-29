import * as React from 'react';
import { cx } from './cx';

export interface TabItem {
  key: string;
  label: React.ReactNode;
  /** Small number next to the label (e.g. unread count). Hidden when null/undefined. */
  count?: number | null;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  /** Accessible name of the tab list. */
  label?: string;
  /** id of the panel the tabs control, for aria-controls. */
  panelId?: string;
  className?: string;
}

/** Tab bar with roving focus: arrow keys, Home and End move between tabs. */
export function Tabs({ items, value, onChange, label, panelId, className }: TabsProps) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = items.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);

  const move = (from: number, dir: 1 | -1 | 'first' | 'last') => {
    if (enabled.length === 0) return;
    let target: number;
    if (dir === 'first') target = enabled[0];
    else if (dir === 'last') target = enabled[enabled.length - 1];
    else {
      const pos = enabled.indexOf(from);
      target = enabled[(pos + dir + enabled.length) % enabled.length];
    }
    refs.current[target]?.focus();
    onChange(items[target].key);
  };

  return (
    <div role="tablist" aria-label={label} className={cx('adm-tabs', className)}>
      {items.map((t, i) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            disabled={t.disabled}
            className="adm-tab"
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i, 1);
              else if (e.key === 'ArrowLeft') move(i, -1);
              else if (e.key === 'Home') move(i, 'first');
              else if (e.key === 'End') move(i, 'last');
              else return;
              e.preventDefault();
            }}
          >
            {t.label}
            {t.count !== undefined && t.count !== null && <span className="adm-tab-count adm-num">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
