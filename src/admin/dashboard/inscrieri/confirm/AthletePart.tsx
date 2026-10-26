import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { RadioGroup, type RadioOption } from '../../../ui';
import type { AthleteField } from '../../../../club/athlete-data';
import type { AthleteCard, ConfirmContext, RegistrationMatchView } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY, MATCH_COPY } from '../../../../club/inscrieri-copy';
import { newAthleteHint, type Choice, type WindowAction, type WindowState } from '../../../../club/inscrieri-confirm';
import { athleteRecordPath, initials, lastGroupText } from '../../../../club/inscrieri-panel';
import { CompareTable } from '../CompareTable';
import { AthleteSearch } from './AthleteSearch';

type Dispatch = React.Dispatch<WindowAction>;
type PartProps = { state: WindowState; dispatch: Dispatch; ctx: ConfirmContext };

/** The proposed (or picked) athlete: initials, name, last group, "Vezi fișa" in the same tab (gaps #33). */
function ProposedCard({ card, onLeave }: { card: AthleteCard; onLeave: () => void }) {
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
      <button type="button" className="ins-link" onClick={open}>
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

type WithAthleteProps = PartProps & { athlete: AthleteCard; notAttended: boolean; onLeave: () => void };

/** Two choice cards, "Compară și actualizează" with the "Actualizează" ticks, "Caută alt sportiv" (spec 4.1, 4.2). */
function WithAthlete({ state, dispatch, ctx, athlete, notAttended, onLeave }: WithAthleteProps) {
  const defaults = ctx.defaultUpdateFields;
  const ticks = { selected: state.ticks ?? defaults, onTick: (field: AthleteField, on: boolean) => dispatch({ type: 'tick', field, on, defaults }) };
  const comparable = ctx.comparison.length > 0;
  return (
    <>
      <ProposedCard card={athlete} onLeave={onLeave} />
      <RadioGroup<Choice> variant="card" aria-label={CONFIRM_COPY.athleteSection} value={state.choice} onChange={(choice) => dispatch({ type: 'choose', choice })} options={choiceOptions(ctx, notAttended)} />
      {state.compareOpen && comparable && <CompareTable rows={ctx.comparison} ticks={ticks} />}
      <div className="ins-links">
        {comparable && (
          <button type="button" className="ins-link" onClick={() => dispatch({ type: 'toggleCompare' })}>
            {state.compareOpen ? CONFIRM_COPY.hide : CONFIRM_COPY.compare}
          </button>
        )}
        <button type="button" className="ins-link" onClick={() => dispatch({ type: 'openSearch' })}>
          {CONFIRM_COPY.searchOther}
        </button>
      </div>
    </>
  );
}

/** No match (spec 4.1): "Sportiv nou" with name and birth date, and "Caută un sportiv existent". */
function NoMatch({ ctx, dispatch }: { ctx: ConfirmContext; dispatch: Dispatch }) {
  return (
    <>
      <div className="ins-acard">
        <span className="ins-av">{initials(ctx.newAthlete.name)}</span>
        <span className="ins-acard-t">
          <b>{CONFIRM_COPY.newLabel}</b>
          <span>{newAthleteHint(ctx, true)}</span>
        </span>
      </div>
      <div className="ins-links">
        <button type="button" className="ins-link" onClick={() => dispatch({ type: 'openSearch' })}>
          {CONFIRM_COPY.searchExisting}
        </button>
      </div>
    </>
  );
}

type AthletePartProps = PartProps & { view: RegistrationMatchView; registrationId: string; onLeave: () => void };

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

/** Section "Sportiv" (spec 4.1). */
export function AthletePart({ state, dispatch, ctx, view, registrationId, onLeave }: AthletePartProps) {
  const choosing = state.mode === 'choose';
  const ref = React.useRef<HTMLElement | null>(null);
  useChoiceFocus(ref, state.mode);
  return (
    <section className="ins-sec" ref={ref}>
      <div className="ins-sec-h">{CONFIRM_COPY.athleteSection}</div>
      {!choosing && <AthleteSearch registrationId={registrationId} query={state.query} dispatch={dispatch} />}
      {choosing && state.athlete && (
        <WithAthlete state={state} dispatch={dispatch} ctx={ctx} athlete={state.athlete} notAttended={view.notAttendedLastSeason} onLeave={onLeave} />
      )}
      {choosing && !state.athlete && <NoMatch ctx={ctx} dispatch={dispatch} />}
    </section>
  );
}
