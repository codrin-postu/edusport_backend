import * as React from 'react';
import { phoneQuery } from '../../club/ui-breakpoints';

/** True while the window is phone width (BP.phone); follows resizes and rotation. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = React.useState(() => window.matchMedia(phoneQuery).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(phoneQuery);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return phone;
}
