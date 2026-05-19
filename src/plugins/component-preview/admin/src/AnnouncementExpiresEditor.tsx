import * as React from 'react';
import { useField, useForm } from '@strapi/admin/strapi-admin';
import { Box, Field, Flex } from '@strapi/design-system';
import { TimePicker } from './components/TimePicker';
import { SafeDatePicker as DatePicker } from './components/SafeDatePicker';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// SafeDatePicker handles timezone safety on the date side; we keep
// hour/minute in separate state and recombine when serializing to ISO.
function parseIso(iso: unknown): { date: Date | undefined; hour: number; minute: number } {
  if (!iso || typeof iso !== 'string') return { date: undefined, hour: 8, minute: 0 };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: undefined, hour: 8, minute: 0 };
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { date: dateOnly, hour: d.getHours(), minute: d.getMinutes() };
}

function buildIso(date: Date, hour: number, minute: number): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
  return d.toISOString();
}

// -----------------------------------------------------------------------
// Main exported component
// -----------------------------------------------------------------------

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

export default function AnnouncementExpiresEditor({ name }: Props) {
  const field = useField(name);
  // useForm exposes the form's setErrors so we can attach our validation
  // message to the same field path that <Field.Error /> reads from.
  const setErrors = useForm(
    'AnnouncementExpiresEditor',
    (state: { setErrors: (errors: Record<string, unknown>) => void; errors: Record<string, unknown> }) => state.setErrors,
  );
  const formErrors = useForm(
    'AnnouncementExpiresEditor',
    (state: { errors: Record<string, unknown> }) => state.errors,
  );

  const [localDate, setLocalDate] = React.useState<Date | undefined>(
    () => parseIso(field.value).date,
  );
  const [localHour, setLocalHour] = React.useState<number>(
    () => parseIso(field.value).hour,
  );
  const [localMinute, setLocalMinute] = React.useState<number>(
    () => parseIso(field.value).minute,
  );

  React.useEffect(() => {
    const { date, hour, minute } = parseIso(field.value);
    setLocalDate(date);
    setLocalHour(hour);
    setLocalMinute(minute);
  }, [field.value]);

  // True when the picked date+time is already in the past (or exactly now).
  const isInPast = React.useMemo(() => {
    if (!localDate) return false;
    const picked = new Date(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localHour,
      localMinute,
      0,
      0,
    );
    return picked.getTime() <= Date.now();
  }, [localDate, localHour, localMinute]);

  const errorMessage = isInPast ? 'Data și ora trebuie să fie în viitor.' : undefined;

  // Keep the form-level error in sync with our local validity, so the standard
  // save flow surfaces it like any other field error.
  React.useEffect(() => {
    setErrors({ ...formErrors, [name]: errorMessage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorMessage, name]);

  // While invalid, stage `null` to the form value rather than a past ISO so the
  // backend never receives a date that's already expired.
  const stageValue = (date: Date | undefined, hour: number, minute: number) => {
    if (!date) {
      field.onChange(name, null);
      return;
    }
    const picked = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
    if (picked.getTime() <= Date.now()) {
      field.onChange(name, null);
      return;
    }
    field.onChange(name, buildIso(date, hour, minute));
  };

  const handleDateChange = (d: Date | undefined) => {
    setLocalDate(d);
    stageValue(d, localHour, localMinute);
  };

  const handleTimeChange = (h: number, m: number) => {
    setLocalHour(h);
    setLocalMinute(m);
    stageValue(localDate, h, m);
  };

  // Allow expiry from today up to 6 months out - pop-ups longer than that are
  // almost always a mistake (forgotten announcements lingering for a year).
  const today = React.useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);
  const maxDate = React.useMemo(() => {
    const m = new Date(today);
    m.setMonth(m.getMonth() + 6);
    return m;
  }, [today]);

  // When the picked date is today, the hour/minute can't be earlier than the
  // current wall clock - otherwise the pop-up would already be expired.
  const minTime = React.useMemo(() => {
    if (!localDate) return undefined;
    const sameDay =
      localDate.getFullYear() === today.getFullYear() &&
      localDate.getMonth() === today.getMonth() &&
      localDate.getDate() === today.getDate();
    if (!sameDay) return undefined;
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  }, [localDate, today]);

  return (
    <Flex gap={3} alignItems="flex-end" wrap="wrap" width="100%">
      {/* flex:1 on both halves keeps date and time pickers visually balanced. */}
      <Box style={{ flex: '1 1 150px', minWidth: 0 }}>
        <Field.Root id={`${name}-date`} name={`${name}-date`} error={errorMessage}>
          <Field.Label>Data expirării</Field.Label>
          <DatePicker
            value={localDate}
            minDate={today}
            maxDate={maxDate}
            onChange={handleDateChange}
            onClear={() => handleDateChange(undefined)}
            clearLabel="Șterge"
            placeholder="zz/ll/aaaa"
          />
          <Field.Error />
        </Field.Root>
      </Box>

      <Box style={{ flex: '1 1 130px', minWidth: 0 }}>
        <Field.Root id={`${name}-time`} name={`${name}-time`} error={errorMessage}>
          <Field.Label>Ora expirării</Field.Label>
          <TimePicker
            id={`${name}-time`}
            hour={localHour}
            minute={localMinute}
            minTime={minTime}
            onChange={handleTimeChange}
          />
          <Field.Error />
        </Field.Root>
      </Box>
    </Flex>
  );
}
