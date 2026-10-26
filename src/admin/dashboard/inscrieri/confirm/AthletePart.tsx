import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Notice, RadioGroup, type RadioOption } from '../../../ui';
import { IconChevronDown, IconChevronUp, IconSearch } from '../../../ui/icons';
import type { AthleteField } from '../../../../club/athlete-data';
import type { AthleteCard, ConfirmContext, RegistrationMatchView } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY, INSCRIERI_PENDING_COPY, MATCH_COPY } from '../../../../club/inscrieri-copy';
import { newAthleteHint, type Choice, type WindowAction, type WindowState } from '../../../../club/inscrieri-confirm';
import { athleteRecordPath, initials, lastGroupText } from '../../../../club/inscrieri-panel';
import { CompareTable } from '../CompareTable';
import { AthleteSearch } from './AthleteSearch';

type Dispatch = React.Dispatch<WindowAction>;
type PartProps = { state: WindowState; dispatch: Dispatch; ctx: ConfirmContext };
/** busy: the confirm request runs. stale: `ctx` is still the previous athlete's (loading, or the reload failed). */
type Flags = { busy: boolean; stale: boolean };

/** The proposed (or picked) athlete: initials, name, last group, "Vezi fișa" in the same tab (gaps #33). */
function ProposedCard({ card, onLeave, busy }: { card: AthleteCard; onLeave: () => void; busy: boolean }) {
  const navigate = useNavigate();
  const open = () => {
    onLeave();
    navigate(athleteRecordPath(card.documentId));
  };
  return (
    <div className="ins-acard">
      <span className="ins-av">{initials(card.name)}</span>
      <span className="ins-acard-t">
        <b>{card.name}</b>
        <span>{lastGroupText(card)}</span>
      </span>
      <button type="button" className="ins-link" disabled={busy} onClick={open}>
        {CONFIRM_COPY.viewRecord}
      </button>
    </div>
  );
}

function choiceOptions(ctx: ConfirmContext, notAttended: boolean): RadioOption<Choice>[] {
  const existingHint = (
    <>
      {CONFIRM_COPY.existingHint}
      {notAttended && <span className="ins-hint2">{MATCH_COPY.notAttended}</span>}
    </>
  );
  return [
    { value: 'existing', label: CONFIRM_COPY.existingLabel, hint: existingHint },
    { value: 'new', label: CONFIRM_COPY.newLabel, hint: newAthleteHint(ctx, false) },
  ];
}

function CompareLink({ open, busy, onToggle }: { open: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="ins-link" aria-expanded={open} disabled={busy} onClick={onToggle}>
      {open ? CONFIRM_COPY.hide : CONFIRM_COPY.compare}
      {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
    </button>
  );
}

function SearchLink({ label, busy, dispatch }: { label: string; busy: boolean; dispatch: Dispatch }) {
  return (
    <button type="button" className="ins-link" disabled={busy} onClick={() => dispatch({ type: 'openSearch' })}>
      <IconSearch size={12} />
      {label}
    </button>
  );
}

type WithAthleteProps = PartProps & Flags & { athlete: AthleteCard; notAttended: boolean; onLeave: () => void };

/** Two choice cards, "Compară și actualizează" with the "Actualizează" ticks, "Caută alt sportiv" (spec 4.1, 4.2).
 * No comparison from a stale context: its rows and default ticks belong to the previous athlete. */
function WithAthlete({ state, dispatch, ctx, athlete, notAttended, onLeave, busy, stale }: WithAthleteProps) {
  const defaults = ctx.defaultUpdateFields;
  const ticks = { selected: state.ticks ?? defaults, onTick: (field: AthleteField, on: boolean) => dispatch({ type: 'tick', field, on, defaults }) };
  const comparable = !stale && ctx.comparison.length > 0;
  const choose = (choice: Choice) => dispatch({ type: 'choose', choice });
  return (
    <>
      <ProposedCard card={athlete} onLeave={onLeave} busy={busy} />
      <RadioGroup<Choice> variant="card" aria-label={CONFIRM_COPY.athleteSection} value={state.choice} onChange={choose} options={choiceOptions(ctx, notAttended)} disabled={busy} />
      {state.compareOpen && comparable && <CompareTable rows={ctx.comparison} ticks={ticks} />}
      <div className="ins-links">
        {comparable && <CompareLink open={state.compareOpen} busy={busy} onToggle={() => dispatch({ type: 'toggleCompare' })} />}
        <SearchLink label={CONFIRM_COPY.searchOther} busy={busy} dispatch={dispatch} />
      </div>
    </>
  );
}

/** No match (spec 4.1): "Sportiv nou" with name and birth date, and "Caută un sportiv existent". */
function NoMatch({ ctx, dispatch, busy }: { ctx: ConfirmContext; dispatch: Dispatch; busy: boolean }) {
  return (
    <>
      <div className="ins-acard ins-acard--new">
        <span className="ins-av">{initials(ctx.newAthlete.name)}</span>
        <span className="ins-acard-t">
          <b>{CONFIRM_COPY.newLabel}</b>
          <span>{newAthleteHint(ctx, true)}</span>
        </span>
      </div>
      <div className="ins-links">
        <SearchLink label={CONFIRM_COPY.searchExisting} busy={busy} dispatch={dispatch} />
      </div>
    </>
  );
}

type AthletePartProps = PartProps & Flags & { view: RegistrationMatchView; registrationId: string; failed: boolean; onLeave: () => void };

function focusTarget(box: HTMLElement, mode: WindowState['mode']): HTMLElement | null {
  if (mode === 'search') return box.querySelector<HTMLElement>('input[type="search"]');
  const radio = box.querySelector<HTMLElement>('input[type="radio"]:checked') ?? box.querySelector<HTMLElement>('input[type="radio"]');
  return radio ?? box.closest<HTMLElement>('[role="dialog"]');
}

/** Once the window has its data, and on every switch between the cards and the search: the radio or the search box. */
function useChoiceFocus(ref: React.RefObject<HTMLElement | null>, mode: WindowState['mode']) {
  React.useEffect(() => {
    if (ref.current) focusTarget(ref.current, mode)?.focus();
  }, [ref, mode]);
}

/** Section "Sportiv" (spec 4.1). A failed reload after a switch shows its notice here; the cards stay to choose again. */
export function AthletePart({ state, dispatch, ctx, view, registrationId, failed, onLeave, busy, stale }: AthletePartProps) {
  const choosing = state.mode === 'choose';
  const ref = React.useRef<HTMLElement | null>(null);
  useChoiceFocus(ref, state.mode);
  return (
    <section className="ins-sec" ref={ref}>
      <div className="ins-sec-h">{CONFIRM_COPY.athleteSection}</div>
      {failed && <Notice tone="danger">{INSCRIERI_PENDING_COPY.loadFailed}</Notice>}
      {!choosing && <AthleteSearch registrationId={registrationId} query={state.query} dispatch={dispatch} />}
      {choosing && state.athlete && (
        <WithAthlete state={state} dispatch={dispatch} ctx={ctx} athlete={state.athlete} notAttended={view.notAttendedLastSeason} onLeave={onLeave} busy={busy} stale={stale} />
      )}
      {choosing && !state.athlete && <NoMatch ctx={ctx} dispatch={dispatch} busy={busy} />}
    </section>
  );
}
