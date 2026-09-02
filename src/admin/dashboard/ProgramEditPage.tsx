import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { EDU_CSS } from './edusportUi';
import { DASHBOARD_TO } from './menu';
import ProgramOverviewEditor from '../../plugins/component-preview/admin/src/ProgramOverviewEditor';
import { ScheduleGroupsInner } from '../../plugins/component-preview/admin/src/ScheduleGroupsEditor';

/**
 * EduSport admin — custom "Program" page, replacing the stock single-type view
 * for api::program.program.
 *
 * The point of moving off the content-manager: its edit view puts the form in
 * a grid column beside a right rail, which is what squeezed the calendar. Here
 * there is no such grid.
 *
 * The fields persist differently, which is why the save button covers only
 * one of them:
 *
 *   overview        ProgramOverviewEditor writes calendar-event records
 *                   straight to the API as you go, so it needs no value and no
 *                   page save. It is rendered as-is.
 *   scheduleGroups  owned by this page, saved with the button.
 *   calendarEvents  legacy fallback the site still reads when the occurrences
 *                   endpoint returns nothing. Deliberately NOT editable here:
 *                   it is old-season data nobody should be hand-editing. The
 *                   save spreads the loaded entry, so the stored value is
 *                   carried through untouched rather than wiped.
 */

const CT = '/content-manager/single-types/api::program.program';

const ProgramEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { get, put } = useFetchClient();

  const [raw, setRaw] = React.useState<Record<string, unknown>>({});
  const [scheduleGroups, setScheduleGroups] = React.useState<unknown>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r: any = await get(CT);
        if (off) return;
        const entry = r?.data?.data ?? r?.data ?? {};
        setRaw(entry);
        setScheduleGroups(Array.isArray(entry.scheduleGroups) ? entry.scheduleGroups : []);
      } catch {
        if (!off) setError(true);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
  }, [get]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      // Spread the loaded entry so overview and calendarEvents, which this
      // page does not manage, are carried through rather than wiped.
      await put(CT, { ...raw, scheduleGroups });
      setDirty(false);
      setMsg({ kind: 'ok', text: 'Modificările au fost salvate.' });
    } catch {
      setMsg({ kind: 'err', text: 'Nu am putut salva. Încearcă din nou.' });
    } finally {
      setSaving(false);
    }
  };

  // `pce` keeps our "Salvează" out of the global admin SaveBar sweep in
  // app.tsx, which would otherwise clip it to 1x1.
  return (
    <div className="eduf pce">
      <style>{EDU_CSS}</style>
      <div className="win">
        <div className="hd">
          <div>
            <h1>Program</h1>
            <p>Calendarul sezonului și seriile de cursuri</p>
          </div>
          <div className="hd-right">
            <button className="btn" type="button" onClick={() => navigate(DASHBOARD_TO)}>
              Înapoi
            </button>
            <button className="btn pri" type="button" onClick={save} disabled={saving || loading}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </div>

        {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

        {loading ? (
          <div className="empty">Se încarcă...</div>
        ) : error ? (
          <div className="empty">Nu am putut încărca programul.</div>
        ) : (
          <div className="body">
            <div className="sec">
              <div className="sh">
                Calendar
                <span className="lbl">se salvează automat</span>
              </div>
              <div className="sb">
                {/* Self-contained: writes calendar-event records itself. */}
                <ProgramOverviewEditor name="overview" attribute={{}} />
              </div>
            </div>

            <div className="sec">
              <div className="sh">Serii de cursuri</div>
              <div className="sb">
                <ScheduleGroupsInner
                  value={scheduleGroups}
                  onChange={(next) => {
                    setScheduleGroups(next);
                    setDirty(true);
                  }}
                />
              </div>
            </div>

          </div>
        )}

        {!loading && !error && (
          <div className="pa">
            <button className="btn" type="button" onClick={() => navigate(DASHBOARD_TO)}>
              Înapoi
            </button>
            <div className="grow" />
            {dirty && <span className="lbl">Ai modificări nesalvate</span>}
            <button className="btn pri" type="button" onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgramEditPage;
