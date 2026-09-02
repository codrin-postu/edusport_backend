import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';

/**
 * Serii Școala de Patinaj.
 *
 * One card per series: start and end time as separate fields, groups as
 * removable chips, drag to reorder.
 *
 * Why the time is split: the stored value is a single free-text `timeSlot`
 * ("10:00 - 10:50"), so any format could be typed. Two fields guarantee the
 * shape, and they are recombined into the same single `timeSlot` string on
 * save, so the public site sees no change (ScheduleSection.tsx reads
 * `timeSlot` and `courses`, nothing else).
 *
 * Order matters: the site renders the series in this order, so reordering had
 * to be possible without deleting and re-adding.
 */

interface ScheduleGroup {
  timeSlot: string;
  courses: string[];
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

/**
 * Value binding, so this editor works both inside Strapi's content-manager
 * form (default export, reads useField) and on the custom Program page, where
 * there is no Form context and the page owns the value.
 */
interface InnerProps {
  value: unknown;
  onChange: (next: ScheduleGroup[]) => void;
}

/** "10:00 - 10:50" -> { from: "10:00", to: "10:50" }. Tolerates any dash and spacing. */
function splitSlot(slot: string): { from: string; to: string } {
  const m = (slot ?? '').split(/\s*[-–—]\s*/);
  return { from: (m[0] ?? '').trim(), to: (m[1] ?? '').trim() };
}

/** Back to the one string the site reads. Blank when neither side is filled. */
function joinSlot(from: string, to: string): string {
  const a = from.trim();
  const b = to.trim();
  if (!a && !b) return '';
  return b ? `${a} - ${b}` : a;
}

const CSS = `
.esg { font-family:system-ui,-apple-system,"Segoe UI",sans-serif; color:#1b1d22; }
.esg * { box-sizing:border-box; }
.esg .serie { border:1px solid #dcdcdc; border-radius:6px; margin-bottom:12px; background:#fff; }
.esg .serie:last-of-type { margin-bottom:0; }
.esg .serie.drag { opacity:.5; }
.esg .serie.over { border-color:#2138b8; box-shadow:0 0 0 2px #eef1fb; }
.esg .sh { display:flex; align-items:center; gap:10px; padding:9px 12px; border-bottom:1px solid #eee; background:#fcfcfd; }
.esg .sh .n { font-size:11px; font-weight:600; color:#888; }
.esg .sh .t { font-size:13px; font-weight:700; font-variant-numeric:tabular-nums; }
.esg .sh .grow { flex:1; }
.esg .grab { color:#b8bcc6; cursor:grab; font-size:14px; line-height:1; user-select:none; }
.esg .sb { padding:11px 12px; }
.esg .fld { margin-bottom:11px; }
.esg .fld:last-child { margin-bottom:0; }
.esg .fld > label { display:block; font-size:10px; color:#888; margin-bottom:3px; text-transform:uppercase; letter-spacing:.05em; font-weight:700; }
.esg input { width:100%; padding:6px 8px; border:1px solid #d0d0d0; border-radius:4px; font-size:13px; font-family:inherit; color:#1b1d22; }
.esg input:focus { outline:none; border-color:#2138b8; }
.esg .times { display:flex; gap:8px; max-width:320px; }
.esg .times > div { flex:1; }
.esg .grps { display:flex; flex-direction:row; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:8px; }
.esg .grps:empty { display:none; }
.esg .grp { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:#2138b8; background:#eef1fb; border:1px solid #cdd6f6; border-radius:4px; padding:4px 8px; white-space:nowrap; }
.esg .grp button { border:none; background:none; color:#2138b8; cursor:pointer; opacity:.7; font-size:11px; padding:0; line-height:1; }
.esg .grp button:hover { opacity:1; }
.esg .rm { border:none; background:none; color:#be3330; cursor:pointer; font-size:14px; line-height:1; padding:0 4px; }
.esg .add { font-size:12px; color:#2138b8; border:1px solid #cdd6f6; background:#eef1fb; border-radius:4px; padding:6px 10px; cursor:pointer; font-weight:600; font-family:inherit; }
.esg .add:hover { background:#e3e9fb; }
.esg .none { padding:22px 4px; color:#888; font-size:13px; font-style:italic; }
.esg .addwrap { margin-top:12px; }
`;

export function ScheduleGroupsInner({ value, onChange }: InnerProps) {
  const [groups, setGroups] = React.useState<ScheduleGroup[]>(() =>
    Array.isArray(value) ? (value as ScheduleGroup[]) : [],
  );
  const [draft, setDraft] = React.useState<Record<number, string>>({});
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (Array.isArray(value)) setGroups(value as ScheduleGroup[]);
  }, [value]);

  // Writes only timeSlot and courses. `duration` and `schedule` used to be
  // stored on every group but were shown by no editor and read by no page, so
  // they are dropped rather than carried forward.
  const commit = (next: ScheduleGroup[]) => {
    const clean = next.map((g) => ({ timeSlot: g.timeSlot ?? '', courses: g.courses ?? [] }));
    setGroups(clean);
    onChange(clean);
  };

  const updateGroup = (i: number, patch: Partial<ScheduleGroup>) =>
    commit(groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  const setTime = (i: number, which: 'from' | 'to', val: string) => {
    const cur = splitSlot(groups[i]?.timeSlot ?? '');
    const next = which === 'from' ? joinSlot(val, cur.to) : joinSlot(cur.from, val);
    updateGroup(i, { timeSlot: next });
  };

  const addGroup = () => commit([...groups, { timeSlot: '', courses: [] }]);
  const removeGroup = (i: number) => commit(groups.filter((_, idx) => idx !== i));

  const addCourse = (gi: number) => {
    const val = (draft[gi] ?? '').trim();
    if (!val) return;
    updateGroup(gi, { courses: [...(groups[gi]?.courses ?? []), val] });
    setDraft((d) => ({ ...d, [gi]: '' }));
  };
  const removeCourse = (gi: number, ci: number) =>
    updateGroup(gi, { courses: (groups[gi]?.courses ?? []).filter((_, i) => i !== ci) });

  const drop = (target: number) => {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...groups];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved!);
    commit(next);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
          <div className="esg">
            <style>{CSS}</style>

            {groups.length === 0 ? (
              <div className="none">Nicio serie adăugată.</div>
            ) : (
              groups.map((group, gi) => {
                const { from, to } = splitSlot(group.timeSlot ?? '');
                const courses = group.courses ?? [];
                return (
                  <div
                    key={gi}
                    className={`serie${dragIndex === gi ? ' drag' : ''}${overIndex === gi && dragIndex !== gi ? ' over' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverIndex(gi);
                    }}
                    onDrop={() => drop(gi)}
                  >
                    <div className="sh">
                      <span
                        className="grab"
                        draggable
                        title="Trage pentru a reordona"
                        onDragStart={() => setDragIndex(gi)}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                      >
                        ⣿
                      </span>
                      <span className="n">Seria {gi + 1}</span>
                      <span className="t">{group.timeSlot || 'fara ora'}</span>
                      <span className="n">
                        {courses.length} {courses.length === 1 ? 'grupa' : 'grupe'}
                      </span>
                      <span className="grow" />
                      <button
                        type="button"
                        className="rm"
                        title="Șterge seria"
                        onClick={() => removeGroup(gi)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="sb">
                      <div className="fld">
                        <label>Interval orar</label>
                        <div className="times">
                          <div>
                            <input
                              type="time"
                              value={from}
                              aria-label={`Seria ${gi + 1} de la`}
                              onChange={(e) => setTime(gi, 'from', e.target.value)}
                            />
                          </div>
                          <div>
                            <input
                              type="time"
                              value={to}
                              aria-label={`Seria ${gi + 1} pana la`}
                              onChange={(e) => setTime(gi, 'to', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="fld">
                        <label>Grupe</label>
                        <div className="grps">
                          {courses.map((c, ci) => (
                            <span className="grp" key={ci}>
                              {c}
                              <button
                                type="button"
                                title="Elimină"
                                onClick={() => removeCourse(gi, ci)}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                        <input
                          value={draft[gi] ?? ''}
                          placeholder="Scrie o grupă și apasă Enter"
                          aria-label={`Adaugă grupă la seria ${gi + 1}`}
                          onChange={(e) => setDraft((d) => ({ ...d, [gi]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCourse(gi);
                            }
                          }}
                          onBlur={() => addCourse(gi)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div className="addwrap">
              <button type="button" className="add" onClick={addGroup}>
                + Adaugă serie
              </button>
            </div>
          </div>
  );
}

/**
 * Content-manager binding. Kept so the field still works on the stock
 * single-type view.
 */
export default function ScheduleGroupsEditor({ name }: Props) {
  const field = useField(name);
  return (
    <Box width="100%">
      <EditorCard
        title="Serii Școala de Patinaj"
        description="Fiecare serie are un interval orar și grupele care intră pe gheață atunci. Ordinea de aici este ordinea de pe site."
      >
        <Box padding={4}>
          <ScheduleGroupsInner
            value={field.value}
            onChange={(next) => field.onChange(name, next)}
          />
        </Box>
      </EditorCard>
    </Box>
  );
}
