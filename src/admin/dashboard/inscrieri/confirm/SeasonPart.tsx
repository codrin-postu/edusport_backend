import * as React from 'react';
import { Checkbox, Field, SearchableSelect } from '../../../ui';
import type { ConfirmContext } from '../../../../club/athletes/api-types';
import { CONFIRM_COPY } from '../../../../club/inscrieri-copy';
import { acsLines, groupChoices, intentParts, mainNowLine, seasonHeading, seasonNote, type WindowAction, type WindowState } from '../../../../club/inscrieri-confirm';

type Props = { state: WindowState; dispatch: React.Dispatch<WindowAction>; ctx: ConfirmContext; busy: boolean };

/** Group (school's groups, then Club, under their section names; optional), main group, A.C.S. (spec 4.3, 4.4). */
function GroupAndAcs({ state, dispatch, ctx, busy }: Props) {
  const mainNow = state.choice === 'existing' ? mainNowLine(ctx) : null;
  const acs = acsLines(ctx);
  return (
    <>
      {mainNow && <p className="ins-line">{mainNow}</p>}
      <Field label={CONFIRM_COPY.group} className="ins-fl">
        <SearchableSelect
          aria-label={CONFIRM_COPY.group}
          value={state.groupId}
          onChange={(groupId) => dispatch({ type: 'group', groupId: groupId || null })}
          options={groupChoices(ctx.groups)}
          placeholder={CONFIRM_COPY.noGroup}
          disabled={busy}
        />
      </Field>
      {mainNow && <Checkbox checked={state.makeMain} disabled={busy || !state.groupId} onChange={(on) => dispatch({ type: 'main', on })} label={CONFIRM_COPY.mainTick} />}
      {acs && (
        <div className="ins-acs">
          <p>{acs.status}</p>
          <p>{acs.wish}</p>
        </div>
      )}
    </>
  );
}

/** The season block (spec 4.3): heading, then the ended line or group and A.C.S.; the form's abonament as the parent's intent (4.4). */
export function SeasonPart({ state, dispatch, ctx, busy, schoolName }: Props & { schoolName: string | null }) {
  const heading = seasonHeading(ctx, schoolName);
  const note = seasonNote(ctx);
  const intent = intentParts(ctx);
  return (
    <section className="ins-sec">
      {heading && <div className="ins-sec-h">{heading}</div>}
      {note ? <p className="ins-note">{note}</p> : <GroupAndAcs state={state} dispatch={dispatch} ctx={ctx} busy={busy} />}
      {intent && (
        <>
          <div className="ins-sec-h">{CONFIRM_COPY.intentHeading}</div>
          <p className="ins-intent">{intent}</p>
        </>
      )}
    </section>
  );
}
