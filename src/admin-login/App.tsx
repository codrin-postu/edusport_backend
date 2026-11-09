import * as React from 'react';
import type { AdminHandoff } from '../club/security/api-types';
import { browserWebauthn } from '../admin/lib/webauthn';
import { post } from './api';
import type { Carry, Deps } from './deps';
import { PATH } from './flow';
import { screenOf } from './route';
import { storeHandoff, storeToken } from './handoff';
import { Done } from './screens/Done';
import { Invite } from './screens/Invite';
import { Login } from './screens/Login';
import { Offer } from './screens/Offer';
import { Reset } from './screens/Reset';
import { SecondStep } from './screens/SecondStep';

type Place = { pathname: string; search: string };
const here = (): Place => ({ pathname: window.location.pathname, search: window.location.search });
const webauthn = browserWebauthn();

/** The six screens of `/intrare`, switched by the address (pushState, no router library). */
export function App() {
  const [place, setPlace] = React.useState<Place>(here);
  const [carry, setCarry] = React.useState<Carry>({});

  React.useEffect(() => {
    const onPop = (): void => setPlace(here());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = React.useCallback((url: string, next: Carry = {}): void => {
    window.history.pushState(null, '', url);
    setCarry(next);
    setPlace(here());
  }, []);

  /** Opens the admin, or first the one-time key offer: the token is stored before the offer so its calls are signed in. */
  const handoff = React.useCallback((h: AdminHandoff): void => {
    if (!h.offerPasskey) return storeHandoff(h, window);
    void webauthn.platformKey().then((yes) => {
      if (!yes) return storeHandoff(h, window);
      storeToken(h.accessToken, h.remember, window);
      go(PATH.offer, { token: h.accessToken });
    });
  }, [go]);

  const deps: Deps = { post, go, handoff, search: place.search, flash: carry.flash ?? null, email: carry.email ?? null, token: carry.token ?? null, webauthn };
  const screen = screenOf(place.pathname);
  if (screen === 'secondStep') return <SecondStep {...deps} />;
  if (screen === 'invite') return <Invite {...deps} />;
  if (screen === 'reset') return <Reset {...deps} />;
  if (screen === 'done') return <Done {...deps} />;
  if (screen === 'offer') return <Offer {...deps} />;
  return <Login {...deps} />;
}
