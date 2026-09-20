import * as React from 'react';
import { useTheme } from 'styled-components';
import { Flex, Popover, Typography } from '@strapi/design-system';
import { Clock } from '@strapi/icons';
import type { StrapiTheme } from '@strapi/design-system';
import { SpinnerInput } from './SpinnerInput';

interface TimePickerProps {
  id: string;
  hour: number;
  minute: number;
  /** Optional lower bound - values before this are clamped on edit. */
  minTime?: { hour: number; minute: number };
  /** Rendered but inert: muted, not focusable, popover stays shut. */
  disabled?: boolean;
  onChange: (hour: number, minute: number) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Free text to { hour, minute }, or null when the text makes no sense.
 * Accepts "9", "23", "9:5", "09:30", "0930", "9.30", "9 30".
 */
export function parseTimeText(raw: string): { hour: number; minute: number } | null {
  const s = String(raw ?? '').trim().replace(/[.,\s-]+/g, ':').replace(/:+/g, ':');
  if (!s) return null;

  let hPart: string;
  let mPart: string;

  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length > 2) return null;
    hPart = parts[0];
    mPart = parts[1] ?? '';
  } else {
    if (!/^\d{1,4}$/.test(s)) return null;
    if (s.length <= 2) {
      hPart = s;
      mPart = '';
    } else if (s.length === 3) {
      hPart = s.slice(0, 1);
      mPart = s.slice(1);
    } else {
      hPart = s.slice(0, 2);
      mPart = s.slice(2);
    }
  }

  if (!/^\d{1,2}$/.test(hPart)) return null;
  if (mPart !== '' && !/^\d{1,2}$/.test(mPart)) return null;

  const hour = Number(hPart);
  const minute = mPart === '' ? 0 : Number(mPart);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * HH:MM field. The value is typed straight into the input; the clock button
 * opens a popover with hour/minute spinners as an optional aid.
 */
export function TimePicker({ id, hour, minute, minTime, disabled = false, onChange }: TimePickerProps) {
  const theme = useTheme() as StrapiTheme;
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  // Raw text while the field is being edited. null means "show the value".
  const [draft, setDraft] = React.useState<string | null>(null);

  const display = draft ?? `${pad(hour)}:${pad(minute)}`;
  const emphasized = !disabled && (open || focused);

  // Hour bounds: minTime.hour..23 when constrained, else 0..23.
  const minHour = minTime?.hour ?? 0;
  // Minute bounds depend on the currently-picked hour. When the hour matches
  // the lower-bound hour, minutes start at minTime.minute; otherwise from 0.
  const minMinute = minTime && hour === minTime.hour ? minTime.minute : 0;

  // Same lower-bound rule the spinners enforce, applied to typed values.
  const clampToMin = (h: number, m: number) => {
    if (!minTime) return { hour: h, minute: m };
    if (h < minTime.hour || (h === minTime.hour && m < minTime.minute)) return { ...minTime };
    return { hour: h, minute: m };
  };

  const handleHourChange = (h: number) => {
    // Reset the minute floor when the hour moves above the lower-bound hour.
    if (minTime && h === minTime.hour && minute < minTime.minute) {
      onChange(h, minTime.minute);
    } else {
      onChange(h, minute);
    }
  };

  const handleMinuteChange = (m: number) => {
    onChange(hour, m);
  };

  // Commit on blur, not on every keystroke: re-padding mid-typing made "23"
  // impossible to enter. Unparsable text falls back to the current value.
  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseTimeText(draft);
    setDraft(null);
    if (!parsed) return;
    const next = clampToMin(parsed.hour, parsed.minute);
    if (next.hour !== hour || next.minute !== minute) onChange(next.hour, next.minute);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Escape') {
      setDraft(null);
    }
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    height: '38px',
    padding: '0 10px',
    border: `1px solid ${theme.colors.neutral200}`,
    borderRadius: theme.borderRadius,
    background: disabled ? theme.colors.neutral150 : theme.colors.neutral0,
    boxSizing: 'border-box',
    // Solid 3px primary ring sitting flush against the field's outer border -
    // no gap, slightly thicker than the default Strapi focus ring.
    outline: emphasized ? `3px solid ${theme.colors.primary600}` : 'none',
    outlineOffset: 0,
    transition: 'outline-color 0.15s',
  };

  const iconButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 18,
    height: 18,
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    width: '100%',
    minWidth: 0,
    height: '100%',
    padding: 0,
    margin: 0,
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    color: disabled ? theme.colors.neutral500 : theme.colors.neutral800,
    fontSize: '1.4rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    letterSpacing: '0.04em',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'text',
  };

  const popoverStyle: React.CSSProperties = {
    background: theme.colors.neutral0,
    border: `1px solid ${theme.colors.neutral150}`,
    borderRadius: theme.borderRadius,
    boxShadow: theme.shadows.popupShadow,
    padding: '16px 20px',
    zIndex: 999,
  };

  return (
    <div style={fieldStyle}>
      <Popover.Root open={open && !disabled} onOpenChange={(next) => setOpen(disabled ? false : next)}>
        {/*
          DS Popover.Trigger always passes asChild:true to Radix internally (Slot),
          so it must receive exactly ONE React element child. The <button> below
          becomes the actual trigger; Radix merges click/aria props into it.
          Styling goes on the button, not the Trigger wrapper.
        */}
        <Popover.Trigger>
          <button
            type="button"
            disabled={disabled}
            aria-label="Alege ora din listă"
            style={iconButtonStyle}
          >
            <Clock
              style={{
                width: 16,
                height: 16,
                color: disabled ? theme.colors.neutral400 : theme.colors.neutral500,
              }}
            />
          </button>
        </Popover.Trigger>

        <Popover.Content style={popoverStyle} sideOffset={8} align="start">
          <Flex alignItems="center" gap={3}>
            <SpinnerInput
              value={hour}
              min={minHour}
              max={23}
              onChange={handleHourChange}
              label="Oră"
            />
            <Typography variant="beta" textColor="neutral500" style={{ userSelect: 'none' }}>
              :
            </Typography>
            <SpinnerInput
              value={minute}
              min={minMinute}
              max={59}
              onChange={handleMinuteChange}
              label="Minut"
            />
          </Flex>
          <Typography
            variant="pi"
            textColor="neutral400"
            style={{ display: 'block', textAlign: 'center', marginTop: '10px' }}
          >
            sau scrie ora direct în câmp
          </Typography>
        </Popover.Content>
      </Popover.Root>

      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        placeholder="HH:MM"
        disabled={disabled}
        value={display}
        style={inputStyle}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commitDraft();
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
