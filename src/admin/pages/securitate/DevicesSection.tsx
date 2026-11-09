import * as React from 'react';
import type { AdminDeviceView } from '../../../club/security/api-types';
import { SECURITY_COPY } from '../../../club/security/copy';
import { longDate } from '../../../club/presence/dates';
import { Notice } from '../../ui/Notice';
import { Section } from '../../ui/Section';
import { errorText } from './errors';
import type { SecurityApi } from './client';
import { Row, mutedStyle } from './layout';
import { PceButton } from './PceButton';
import { afterDisconnect, untilDate } from './state';

const C = SECURITY_COPY.devices;
const day = (iso: string): string => longDate(iso.slice(0, 10));

/** The device rows: name, last time, the remembered-2FA line when set, "Deconectează". */
export function DevicesList({ devices, busy, onDisconnect }: { devices: AdminDeviceView[]; busy: boolean; onDisconnect: (d: AdminDeviceView) => void }) {
  return (
    <>
      <Row first>
        <span style={mutedStyle}>{C.device}</span>
        <span style={mutedStyle}>{C.lastSeen}</span>
      </Row>
      {devices.map((d) => {
        const until = untilDate(d.twoFactorUntil, longDate);
        return (
          <Row key={d.id}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>{d.label}</span>
              {d.current && <span style={mutedStyle}>{C.current}</span>}
              {until && <span style={mutedStyle}>{C.rememberedUntil(until)}</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={mutedStyle}>{day(d.lastSeenAt)}</span>
              <PceButton variant="secondary" size="sm" disabled={busy} onClick={() => onDisconnect(d)}>{C.disconnect}</PceButton>
            </span>
          </Row>
        );
      })}
    </>
  );
}

/** "Dispozitive": this admin's devices. Disconnecting this browser's own ends this session, so the page goes to `/login`. */
export function DevicesSection({ api, goTo }: { api: SecurityApi; goTo: (path: string) => void }) {
  const [devices, setDevices] = React.useState<AdminDeviceView[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => api.devices().then(setDevices), [api]);
  React.useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [load]);

  const disconnect = async (d: AdminDeviceView): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const to = afterDisconnect(await api.disconnect(d.id));
      if (to) return goTo(to);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={C.title}>
      {error && <Notice tone="danger">{error}</Notice>}
      {devices && <DevicesList devices={devices} busy={busy} onDisconnect={(d) => void disconnect(d)} />}
    </Section>
  );
}
