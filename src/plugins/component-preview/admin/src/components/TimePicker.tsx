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
  onChange: (hour: number, minute: number) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** HH:MM time input rendered as a styled trigger that opens a popover with hour/minute spinners. */
export function TimePicker({ id, hour, minute, minTime, onChange }: TimePickerProps) {
  const theme = useTheme() as StrapiTheme;
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  const display = `${pad(hour)}:${pad(minute)}`;
  const emphasized = open || focused;

  // Hour bounds: minTime.hour..23 when constrained, else 0..23.
  const minHour = minTime?.hour ?? 0;
  // Minute bounds depend on the currently-picked hour. When the hour matches
  // the lower-bound hour, minutes start at minTime.minute; otherwise from 0.
  const minMinute = minTime && hour === minTime.hour ? minTime.minute : 0;

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

  const triggerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: '38px',
    padding: '0 12px',
    border: `1px solid ${theme.colors.neutral200}`,
    borderRadius: theme.borderRadius,
    background: theme.colors.neutral0,
    color: theme.colors.neutral800,
    fontSize: theme.fontSizes[2],
    fontFamily: 'inherit',
    cursor: 'pointer',
    // Solid 3px primary ring sitting flush against the input's outer border -
    // no gap, slightly thicker than the default Strapi focus ring.
    outline: emphasized ? `3px solid ${theme.colors.primary600}` : 'none',
    outlineOffset: 0,
    transition: 'outline-color 0.15s',
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
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/*
        DS Popover.Trigger always passes asChild:true to Radix internally (Slot),
        so it must receive exactly ONE React element child. The <button> below
        becomes the actual trigger; Radix merges click/aria props into it.
        Styling goes on the button, not the Trigger wrapper.
      */}
      <Popover.Trigger>
        <button
          type="button"
          id={id}
          style={triggerStyle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          <Clock style={{ width: 16, height: 16, color: theme.colors.neutral400, flexShrink: 0 }} />
          <span style={{ fontSize: '1.4rem', fontWeight: 500, letterSpacing: '0.04em' }}>
            {display}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Content style={popoverStyle} sideOffset={4} align="start">
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
          sau editează direct
        </Typography>
      </Popover.Content>
    </Popover.Root>
  );
}
