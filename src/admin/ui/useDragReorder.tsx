import * as React from 'react';

/**
 * Drag-to-reorder for lists and grids, with a keyboard path.
 *
 *   const drag = useDragReorder({ count: items.length, onMove: (from, to) => onChange(moveItem(items, from, to)) });
 *   <li {...drag.itemProps(i)}>
 *     <button {...drag.handleProps(i)} aria-label="Mută">...</button>
 *   </li>
 *   {drag.live}
 *
 * - Mouse: native HTML5 drag, started from the handle only (the whole item
 *   is the drag image). A line marks the drop spot (data-drop="before" /
 *   "after" on the item); the move is committed once, on drop.
 * - Keyboard: on the handle, ArrowUp/ArrowDown (and Left/Right for grids)
 *   move the item; anywhere inside the item, Alt+ArrowUp/ArrowDown does the
 *   same. Focus stays on the element that had it; the new position is read
 *   out through a polite live region (`live`).
 */

export interface UseDragReorderOptions {
  count: number;
  /** Called with the item's old index and its final index. */
  onMove: (from: number, to: number) => void;
  /** 'y' for lists (default), 'x' or 'grid' for tiles (left / right halves decide the side). */
  axis?: 'x' | 'y' | 'grid';
  disabled?: boolean;
  /**
   * Fixed slots: dropping on an item swaps the two (onMove(from, target)),
   * instead of inserting before / after it.
   */
  swap?: boolean;
  /** Announcement after a move. Default "Mutat pe poziția 2 din 5." */
  announce?: (to: number, count: number) => string;
}

export interface DragItemProps {
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  'data-ui-drag-item': string;
  'data-dragging'?: 'true';
  'data-drop'?: 'before' | 'after' | 'on';
}

export interface DragHandleProps {
  draggable: boolean;
  onDragStart: (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  ref: (el: HTMLElement | null) => void;
  'aria-describedby'?: string;
}

export interface DragReorder {
  /** Index being dragged, or null. */
  dragging: number | null;
  itemProps: (index: number) => DragItemProps;
  handleProps: (index: number) => DragHandleProps;
  /** Move programmatically (buttons); clamps and announces. */
  move: (from: number, to: number) => void;
  /** Screen-reader live region + the handle instructions; render it once. */
  live: React.ReactElement;
}

/** Copy of `arr` with the item at `from` moved to index `to`. */
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = arr.slice();
  if (from < 0 || from >= next.length) return next;
  const [it] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, it);
  return next;
}

const defaultAnnounce = (to: number, count: number) => `Mutat pe poziția ${to + 1} din ${count}.`;

export function useDragReorder({ count, onMove, axis = 'y', disabled = false, swap = false, announce = defaultAnnounce }: UseDragReorderOptions): DragReorder {
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<{ index: number; side: 'before' | 'after' | 'on' } | null>(null);
  const handles = React.useRef<Array<HTMLElement | null>>([]);
  const focusHandle = React.useRef<number | null>(null);
  const [message, setMessage] = React.useState('');
  const from = React.useRef<number | null>(null);
  const refocus = React.useRef<HTMLElement | null>(null);
  const hintId = React.useId().replace(/:/g, '');
  const onMoveRef = React.useRef(onMove);
  onMoveRef.current = onMove;

  // React re-inserts moved nodes, which can drop focus: give it back. A
  // focused handle follows its item to the new index.
  React.useEffect(() => {
    const h = focusHandle.current;
    focusHandle.current = null;
    if (h !== null) {
      refocus.current = null;
      const el = handles.current[h];
      if (el && document.activeElement !== el) el.focus();
      return;
    }
    const el = refocus.current;
    if (!el) return;
    refocus.current = null;
    if (document.contains(el) && document.activeElement !== el) el.focus();
  });

  const move = React.useCallback(
    (a: number, b: number) => {
      const to = Math.max(0, Math.min(b, count - 1));
      if (disabled || a === to || a < 0 || a >= count) return;
      refocus.current = document.activeElement as HTMLElement | null;
      if (refocus.current && refocus.current === handles.current[a]) focusHandle.current = to;
      onMoveRef.current(a, to);
      setMessage(announce(to, count));
    },
    [count, disabled, announce],
  );

  const end = () => {
    from.current = null;
    setDragging(null);
    setOver(null);
  };

  const keyMove = (e: React.KeyboardEvent<HTMLElement>, index: number, needAlt: boolean) => {
    if (disabled || (needAlt && !e.altKey)) return;
    // On the row itself, Alt+arrows must not steal the text-editing shortcut
    // (Alt+Up/Down jumps to the paragraph start/end in macOS text fields).
    if (needAlt) {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    }
    const back = e.key === 'ArrowUp' || (axis !== 'y' && e.key === 'ArrowLeft');
    const fwd = e.key === 'ArrowDown' || (axis !== 'y' && e.key === 'ArrowRight');
    if (!back && !fwd) return;
    e.preventDefault();
    e.stopPropagation();
    move(index, back ? index - 1 : index + 1);
  };

  const itemProps = (index: number): DragItemProps => ({
    'data-ui-drag-item': '',
    'data-dragging': dragging === index ? 'true' : undefined,
    'data-drop': over && over.index === index && dragging !== null ? over.side : undefined,
    onDragOver: (e) => {
      if (from.current === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      const side: 'before' | 'after' | 'on' = swap
        ? 'on'
        : axis === 'y'
          ? e.clientY < r.top + r.height / 2
            ? 'before'
            : 'after'
          : e.clientX < r.left + r.width / 2
            ? 'before'
            : 'after';
      setOver((o) => (o && o.index === index && o.side === side ? o : { index, side }));
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setOver((o) => (o && o.index === index ? null : o));
      }
    },
    onDrop: (e) => {
      if (from.current === null) return;
      e.preventDefault();
      const f = from.current;
      const r = e.currentTarget.getBoundingClientRect();
      const before = axis === 'y' ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
      let to = before ? index : index + 1;
      if (f < to) to -= 1;
      if (swap) to = index;
      end();
      if (to !== f) {
        onMoveRef.current(f, to);
        setMessage(announce(to, count));
      }
    },
    onKeyDown: (e) => keyMove(e, index, true),
  });

  const handleProps = (index: number): DragHandleProps => ({
    draggable: !disabled,
    'aria-describedby': disabled ? undefined : hintId,
    onDragStart: (e) => {
      if (disabled) return;
      from.current = index;
      setDragging(index);
      e.dataTransfer.effectAllowed = 'move';
      // Firefox needs data to start a drag.
      e.dataTransfer.setData('text/plain', String(index));
      const item = (e.currentTarget as HTMLElement).closest('[data-ui-drag-item]');
      if (item instanceof HTMLElement) {
        const r = item.getBoundingClientRect();
        e.dataTransfer.setDragImage(item, e.clientX - r.left, e.clientY - r.top);
      }
    },
    onDragEnd: end,
    onKeyDown: (e) => keyMove(e, index, false),
    ref: (el) => {
      handles.current[index] = el;
    },
  });

  const live = (
    <>
      <span id={hintId} className="ui-sr">
        {axis === 'y'
          ? 'Trage pentru a reordona, sau folosește săgețile sus și jos.'
          : 'Trage pentru a reordona, sau folosește săgețile stânga și dreapta.'}
      </span>
      <span className="ui-sr" role="status" aria-live="polite">
        {message}
      </span>
    </>
  );

  return { dragging, itemProps, handleProps, move, live };
}

export default useDragReorder;
