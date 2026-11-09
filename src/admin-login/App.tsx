import * as React from 'react';
import type { AdminHandoff } from '../club/security/api-types';
import { post } from './api';
import type { Carry, Deps } from './deps';
import { screenOf } from './route';
import { storeHandoff } from './handoff';
import { Done } from './screens/Done';
import { Invite } from './screens/Invite';
import { Login } from './screens/Login';
import { Reset } from './screens/Reset';
import { SecondStep } from './screens/SecondStep';

type Place = { pathname: string; search: string };
const here = (): Place => ({ pathname: window.location.pathname, search: window.location.search });
const handoff = (h: AdminHandoff): void => storeHandoff(h, window);

/** The five screens of `/intrare`, switched by the address (pushState, no router library). */
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

  const deps: Deps = { post, go, handoff, search: place.search, flash: carry.flash ?? null, email: carry.email ?? null };
  const screen = screenOf(place.pathname);
  if (screen === 'secondStep') return <SecondStep {...deps} />;
  if (screen === 'invite') return <Invite {...deps} />;
  if (screen === 'reset') return <Reset {...deps} />;
  if (screen === 'done') return <Done {...deps} />;
  return <Login {...deps} />;
}
