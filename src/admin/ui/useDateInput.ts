import * as React from 'react';
import { maskSlash, readTypedDate } from '../../club/date-format';

type Options = { min?: string; max?: string; emitDay: (iso: string | null) => void; value: string | null };

/** The typed draft of a date field: what is shown while typing, whether it is invalid, and the calendar button. */
export function useDateInput({ min, max, emitDay, value }: Options) {
  const native = React.useRef<HTMLInputElement>(null);
  const [draft, setDraft] = React.useState<string | null>(null);
  const [invalid, setInvalid] = React.useState(false);
  // A new value from outside (or our own emit) replaces whatever was being typed.
  React.useEffect(() => {
    setDraft(null);
    setInvalid(false);
  }, [value]);

  const type = (text: string) => {
    const masked = maskSlash(text);
    const read = readTypedDate(masked, min, max);
    setDraft(masked);
    setInvalid(read.kind === 'invalid' && masked.length === 10);
    if (read.kind === 'empty') emitDay(null);
    else if (read.kind === 'ok') emitDay(read.iso);
  };

  /** A half typed draft is dropped on blur; a full one that is not a usable date stays, marked invalid. */
  const settle = () => {
    if (!invalid) setDraft(null);
  };

  const openPicker = () => {
    const input = native.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.focus();
  };

  return { native, draft, invalid, type, settle, openPicker };
}
