import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { getFetchClient } from '@strapi/admin/strapi-admin';
import { TOUR_COPY, WELCOME_COPY } from '../../club/onboarding/copy';
import { isFlowId } from '../../club/onboarding/flows';
import { currentStep, progressOf, tourReducer, type TourEffect, type TourEvent, type TourState } from '../../club/onboarding/machine';
import { placeCard } from '../../club/onboarding/placement';
import { anchorSelector, welcomeRole } from '../../club/onboarding/role';
import { PRIMII_PASI_TO } from '../dashboard/menu';
import { spaNavigate } from '../dashboard/EdusportShell';
import { useIsPhone } from '../dashboard/useIsPhone';
import { useAreas } from '../lib/useAreas';
import { useFeatures } from '../lib/useFeatures';
import { adminToast, ensureAdminUi } from '../ui';
import { installFetchGuard, uninstallFetchGuard } from './fetchGuard';
import { loadProgress, markProgress, setTourRunning, START_EVENT, useTourProgress } from './progressStore';
import { TourCard } from './TourCard';
import { TOUR_CSS } from './tourCss';
import { useAnchor } from './useAnchor';
import { WelcomeDialog } from './WelcomeDialog';

const ROOT_ID = 'edusport-tour-root';
const IDLE: TourState = { kind: 'idle' };
const CARD_WIDTH = 320;

function handleEffect(prev: TourState, effect: TourEffect | undefined): void {
  if (effect === 'introDone') {
    adminToast.success(TOUR_COPY.introDone);
    void markProgress({ intro: true });
  } else if (effect === 'left') {
    if (prev.kind === 'intro') void markProgress({ intro: true });
    else spaNavigate(PRIMII_PASI_TO);
  } else if (effect) {
    adminToast.success(TOUR_COPY.doneToast);
    void markProgress({ flow: effect.flowDone });
    spaNavigate(PRIMII_PASI_TO);
  }
}

/** The state machine plus its side effects: the fetch guard lives only while a flow runs and is back before any progress post. */
function useTour(): { state: TourState; send: (e: TourEvent) => void } {
  const [state, setState] = React.useState<TourState>(IDLE);
  const ref = React.useRef<TourState>(IDLE);
  const { on } = useFeatures();
  const onRef = React.useRef(on);
  onRef.current = on;
  const send = React.useCallback((e: TourEvent) => {
    const prev = ref.current;
    const { state: next, effect } = tourReducer(prev, e);
    const flowOf = (t: TourState) => (t.kind === 'flow' ? t.flow : undefined);
    if (flowOf(next) !== flowOf(prev)) {
      if (next.kind === 'flow' && next.flow) installFetchGuard(next.flow);
      else uninstallFetchGuard();
    }
    setTourRunning(next.kind !== 'idle');
    ref.current = next;
    setState(next);
    handleEffect(prev, effect);
  }, []);
  React.useEffect(() => {
    const onStart = (ev: Event) => {
      const flow = (ev as CustomEvent<{ flow?: unknown }>).detail?.flow;
      send(isFlowId(flow) ? { type: 'startFlow', id: flow, on: onRef.current } : { type: 'startIntro' });
    };
    window.addEventListener(START_EVENT, onStart);
    return () => {
      window.removeEventListener(START_EVENT, onStart);
      uninstallFetchGuard();
    };
  }, [send]);
  return { state, send };
}

/** Esc leaves; the real click or change on the anchor advances. The final step's click never reaches the page. */
function useStepEvents(state: TourState, send: (e: TourEvent) => void): void {
  const step = currentStep(state);
  React.useEffect(() => {
    if (!step) return undefined;
    const hit = (e: Event): boolean => {
      const t = e.target;
      return t instanceof Node && Array.from(document.querySelectorAll(anchorSelector(step.anchor))).some((el) => el.contains(t));
    };
    const on = (via: 'click' | 'change') => (e: Event) => {
      if (step.waitFor !== via || !hit(e)) return;
      if (via === 'click' && step.final) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      send({ type: 'target', anchor: step.anchor, via });
    };
    const onClick = on('click');
    const onChange = on('change');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && send({ type: 'exit' });
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [step, send]);
}

function TourChrome({ state, send }: { state: TourState; send: (e: TourEvent) => void }) {
  const phone = useIsPhone();
  const step = currentStep(state);
  const box = useAnchor(step, phone);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(180);
  React.useLayoutEffect(() => setHeight(cardRef.current?.offsetHeight ?? 180), [step, box]);
  if (!step) return null;
  const placement = placeCard(box, { width: CARD_WIDTH, height }, { width: window.innerWidth, height: window.innerHeight }, phone);
  return (
    <>
      <div className="tour-dim" />
      {box && <div className="tour-outline" style={{ top: box.top - 3, left: box.left - 3, width: box.width + 6, height: box.height + 6 }} />}
      {state.kind === 'flow' && <div className="tour-strip">{TOUR_COPY.strip}</div>}
      <TourCard ref={cardRef} step={step} progress={progressOf(state)} placement={placement} onNext={() => send({ type: 'next' })} onExit={() => send({ type: 'exit' })} />
    </>
  );
}

/** Reads once the admin is signed in (`ready`), so a root mounted before the login retries afterwards. */
function useFirstName(ready: boolean): string | null {
  const [name, setName] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!ready) return undefined;
    let off = false;
    getFetchClient()
      .get('/admin/users/me')
      .then((r) => {
        const u = (r.data as { data?: { firstname?: string; email?: string } }).data;
        if (!off) setName(u?.firstname?.trim() || u?.email?.split('@')[0] || '');
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [ready]);
  return name;
}

function TourRoot() {
  const { ready, has } = useAreas();
  const { ready: progressReady, progress } = useTourProgress();
  const firstName = useFirstName(ready);
  React.useEffect(() => {
    if (ready && !progressReady) void loadProgress();
  }, [ready, progressReady]);
  const { state, send } = useTour();
  const [later, setLater] = React.useState(false);
  useStepEvents(state, send);
  const welcome = ready && progressReady && firstName !== null && progress.introAt === null && state.kind === 'idle' && !later;

  const dismiss = () => {
    setLater(true);
    adminToast.info(WELCOME_COPY.laterToast);
    void markProgress({ intro: true });
  };
  return (
    <div className="ui-root">
      <style>{TOUR_CSS}</style>
      {welcome && <WelcomeDialog firstName={firstName} role={welcomeRole(has)} onLater={dismiss} onStart={() => { setLater(true); send({ type: 'startIntro' }); }} />}
      {ready && <TourChrome state={state} send={send} />}
    </div>
  );
}

export function mountTourRoot(): void {
  if (document.getElementById(ROOT_ID)) return;
  ensureAdminUi();
  const root = document.createElement('div');
  root.id = ROOT_ID;
  document.body.appendChild(root);
  createRoot(root).render(<TourRoot />);
}
