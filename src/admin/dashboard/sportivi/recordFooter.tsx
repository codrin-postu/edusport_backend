import * as React from 'react';
import { Button } from '../../ui';

export type FooterAction = { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean; loading?: boolean };
type SetFooter = (actions: FooterAction[] | null) => void;

/** Set on phones by the record's bottom sheet: the visible tab puts its buttons in the sticky footer (spec 6.1). */
export const RecordFooterContext = React.createContext<SetFooter | null>(null);

/**
 * Hands `actions` to the phone footer and returns true when it did (the tab then renders no
 * buttons of its own). Re-sent only when a label or state changes; clicks always reach the
 * latest handlers.
 */
export function useRecordFooter(actions: FooterAction[] | null): boolean {
  const set = React.useContext(RecordFooterContext);
  const latest = React.useRef(actions);
  latest.current = actions;
  const key = actions ? actions.map((a) => `${a.label}:${a.disabled ? 1 : 0}:${a.loading ? 1 : 0}`).join('|') : '';
  React.useEffect(() => {
    if (!set) return undefined;
    const now = latest.current;
    set(now ? now.map((a, i) => ({ ...a, onClick: () => latest.current?.[i]?.onClick() })) : null);
    return () => set(null);
  }, [set, key]);
  return set !== null;
}

export function FooterButtons({ actions }: { actions: FooterAction[] }) {
  return (
    <>
      {actions.map((a) => (
        <Button key={a.label} variant={a.variant ?? 'primary'} onClick={a.onClick} disabled={a.disabled} loading={a.loading}>
          {a.label}
        </Button>
      ))}
    </>
  );
}
