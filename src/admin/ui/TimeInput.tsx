import * as React from 'react';
import { cx } from './cx';
import { useFieldControl } from './Field';
import { NumberInput } from './NumberInput';
import { Popover } from './Popover';
import { IconClock } from './icons';

/**
 * HH:MM field: the time is typed straight in ("9", "930", "9.30", "09:30"
 * all work, committed on blur or Enter), the clock button opens hour and
 * minute spinners as an aid. Optional min / max clamp typed and spun values.
 * Port of the plugin's components/TimePicker, on tokens and without Strapi DS.
 *
 * Value contract: "HH:MM" or null for empty. Strapi time attributes
 * ("HH:MM:SS.mmm") are accepted as input; pass format="strapi" to get that
 * shape back.
 */

export interface HourMinute {
  hour: number;
  minute: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Free text to { hour, minute }, or null when the text makes no sense.
 * Accepts "9", "23", "9:5", "09:30", "0930", "9.30", "9 30", "09:30:00.000".
 */
export function parseTimeText(raw: string): HourMinute | null {
  let s = String(raw ?? '').trim();
  // Strapi time: drop seconds and milliseconds.
  const full = /^(\d{1,2}):(\d{2}):\d{2}(\.\d+)?$/.exec(s);
  if (full) s = `${full[1]}:${full[2]}`;
  s = s.replace(/[.,\s-]+/g, ':').replace(/:+/g, ':');
  if (!s) return null;
  let h: string;
  let m: string;
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length > 2) return null;
    h = parts[0];
    m = parts[1] ?? '';
  } else {
    if (!/^\d{1,4}$/.test(s)) return null;
    if (s.length <= 2) [h, m] = [s, ''];
    else if (s.length === 3) [h, m] = [s.slice(0, 1), s.slice(1)];
    else [h, m] = [s.slice(0, 2), s.slice(2)];
  }
  if (!/^\d{1,2}$/.test(h) || (m !== '' && !/^\d{1,2}$/.test(m))) return null;
  const hour = Number(h);
  const minute = m === '' ? 0 : Number(m);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export const formatTime = ({ hour, minute }: HourMinute) => `${pad2(hour)}:${pad2(minute)}`;

const toMin = (t: HourMinute) => t.hour * 60 + t.minute;
const fromMin = (n: number): HourMinute => ({ hour: Math.floor(n / 60), minute: n % 60 });

export interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> {
  /** "HH:MM" (or Strapi "HH:MM:SS.mmm"), null for empty. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Earliest allowed time, "HH:MM". */
  min?: string;
  /** Latest allowed time, "HH:MM". */
  max?: string;
  /** Output shape: "HH:MM" (default) or Strapi's "HH:MM:00.000". */
  format?: 'hh:mm' | 'strapi';
  /** Empty text commits null. Default true. */
  allowEmpty?: boolean;
}

export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(function TimeInput(
  { value, onChange, min, max, format = 'hh:mm', allowEmpty = true, disabled, className, placeholder = 'HH:MM', onBlur, onFocus, onKeyDown, ...props },
  ref,
) {
  const p = useFieldControl(props);
  const [draft, setDraft] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLSpanElement | null>(null);
  const popId = React.useId().replace(/:/g, '');

  const cur = value ? parseTimeText(value) : null;
  const lo = min ? parseTimeText(min) : null;
  const hi = max ? parseTimeText(max) : null;

  const clamp = (t: HourMinute): HourMinute => {
    let n = toMin(t);
    if (lo && n < toMin(lo)) n = toMin(lo);
    if (hi && n > toMin(hi)) n = toMin(hi);
    return fromMin(n);
  };

  const emit = (t: HourMinute | null) => {
    const out = t ? (format === 'strapi' ? `${formatTime(t)}:00.000` : formatTime(t)) : null;
    const same = t && cur ? toMin(t) === toMin(cur) : t === cur;
    if (!same) onChange(out);
  };

  const commit = () => {
    if (draft === null) return;
    const text = draft;
    setDraft(null);
    if (text.trim() === '') {
      if (allowEmpty) emit(null);
      return;
    }
    const parsed = parseTimeText(text);
    if (parsed) emit(clamp(parsed));
  };

  const base = cur ?? lo ?? { hour: 0, minute: 0 };
  const minHour = lo?.hour ?? 0;
  const maxHour = hi?.hour ?? 23;
  const minMinute = lo && base.hour === lo.hour ? lo.minute : 0;
  const maxMinute = hi && base.hour === hi.hour ? hi.minute : 59;

  return (
    <span ref={wrapRef} className={cx('adm-root', 'adm-time', disabled && 'adm-time--disabled', className)}>
      <button
        type="button"
        className="adm-time-btn"
        aria-label="Alege ora"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <IconClock />
      </button>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        placeholder={placeholder}
        className="adm-input"
        disabled={disabled}
        {...p}
        value={draft ?? (cur ? formatTime(cur) : '')}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          e.target.select();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          commit();
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape' && draft !== null) {
            e.preventDefault();
            setDraft(null);
          } else if (e.key === 'ArrowDown' && e.altKey) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Popover open={open && !disabled} anchorRef={wrapRef} onClose={() => setOpen(false)} id={popId} role="dialog" className="adm-time-pop" offset={6} popoverProps={{ 'aria-label': 'Alege ora' }}>
        <div className="adm-time-spin">
          <NumberInput
            size="lg"
            label="ora"
            aria-label="Oră"
            value={base.hour}
            min={minHour}
            max={maxHour}
            wrap
            pad={2}
            allowEmpty={false}
            onChange={(h) => {
              if (h === null) return;
              emit(clamp({ hour: h, minute: base.minute }));
            }}
          />
          <span className="adm-time-colon" aria-hidden="true">
            :
          </span>
          <NumberInput
            size="lg"
            label="minutul"
            aria-label="Minut"
            value={base.minute}
            min={minMinute}
            max={maxMinute}
            wrap
            pad={2}
            allowEmpty={false}
            onChange={(m) => {
              if (m === null) return;
              emit(clamp({ hour: base.hour, minute: m }));
            }}
          />
        </div>
        <div className="adm-hint adm-time-note">sau scrie ora direct în câmp</div>
      </Popover>
    </span>
  );
});

export default TimeInput;
