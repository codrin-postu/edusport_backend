import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Loading, Notice } from '../../ui';
import { GROUP_ERRORS, NEW_SEASON_COPY } from '../../../club/groups/copy';
import { initialTicks, type Ticks } from '../../../club/groups/new-season/window-view';
import { grupeListTo } from '../../../club/grupe/routes';
import { requestErrorText } from '../../../club/registration-panel';
import { useGrupeApi } from '../../dashboard/grupe/api';
import { WindowShell } from '../../dashboard/grupe/PanelShell';
import { undoToast } from '../../dashboard/grupe/undo';
import { StepOne, StepThree, StepTwo } from './NewSeasonSteps';
import { useNewSeason } from './useNewSeason';

type Props = { season: { documentId: string; label: string }; onClose: () => void };

/** The toast shows what the apply wrote (it plans again at apply time), not the preview's counts. */
function useApply(ns: ReturnType<typeof useNewSeason>, ticks: Ticks | null) {
  const navigate = useNavigate();
  const grupe = useGrupeApi();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async () => {
    if (!ns.data || !ticks) return;
    setBusy(true);
    try {
      const res = await ns.apply(ns.data, ticks);
      navigate(grupeListTo(res.data.season, null));
      undoToast(res.data.toast, res.undo?.actionId ?? null, grupe);
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
      setBusy(false);
    }
  };
  return { busy, error, run };
}

type FooterProps = { step: number; setStep: (n: number) => void; onClose: () => void; busy: boolean; ready: boolean; previewReady: boolean; apply: () => void; label: string };

function DialogFooter({ step, setStep, onClose, busy, ready, previewReady, apply, label }: FooterProps) {
  return (
    <>
      <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(step - 1)} disabled={busy}>{step === 1 ? NEW_SEASON_COPY.cancel : NEW_SEASON_COPY.back}</Button>
      {step < 3 ? <Button onClick={() => setStep(step + 1)} disabled={!ready}>{NEW_SEASON_COPY.next}</Button> : <Button loading={busy} disabled={!previewReady} onClick={apply}>{NEW_SEASON_COPY.apply(label)}</Button>}
    </>
  );
}

type BodyProps = { step: number; ns: ReturnType<typeof useNewSeason>; ticks: Ticks | null; setTicks: (t: Ticks) => void };

function StepBody({ step, ns, ticks, setTicks }: BodyProps) {
  if (!ns.data || !ticks) return <Loading />;
  if (step === 1) return <StepOne data={ns.data} />;
  if (step === 2) return <StepTwo data={ns.data} ticks={ticks} setTicks={setTicks} preview={ns.preview} />;
  return ns.preview ? <StepThree preview={ns.preview} /> : <Loading />;
}

/** "Începe sezonul <next>" (10.2): three steps; nothing is written before the last button (W24). */
export function NewSeasonDialog({ season, onClose }: Props) {
  const ns = useNewSeason(season.documentId);
  const { data, refresh } = ns;
  const [step, setStep] = React.useState(1);
  const [ticks, setTicksState] = React.useState<Ticks | null>(null);
  React.useEffect(() => {
    if (data && !ticks) {
      const t = initialTicks(data);
      setTicksState(t);
      refresh(data, t);
    }
  }, [data, ticks, refresh]);
  const setTicks = (t: Ticks) => { setTicksState(t); if (data) refresh(data, t); };
  const act = useApply(ns, ticks);
  const failed = ns.failed ? requestErrorText(ns.failed, GROUP_ERRORS.loadFailed) : null;
  const footer = <DialogFooter step={step} setStep={setStep} onClose={onClose} busy={act.busy} ready={!!data} previewReady={!!ns.preview} apply={() => void act.run()} label={season.label} />;
  return (
    <WindowShell title={<>{NEW_SEASON_COPY.title(season.label)} <span className="spv-muted">{NEW_SEASON_COPY.stepOf(step)}</span></>} onClose={onClose} footer={footer} size="lg">
      {(act.error || failed) && <Notice tone="danger">{act.error ?? failed}</Notice>}
      <StepBody step={step} ns={ns} ticks={ticks} setTicks={setTicks} />
    </WindowShell>
  );
}
