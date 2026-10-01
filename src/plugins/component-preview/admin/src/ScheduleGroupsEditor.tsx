import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
// Shared admin UI (same vite bundle as src/admin, see ParticipantsEditor).
import { EditorCard, Field, RepeatableList, TagsInput, TimeInput, ensureAdminUi } from '../../../../admin/ui';

/**
 * Serii Școala de Patinaj.
 *
 * One row per series on the shared RepeatableList (drag / arrow-key reorder,
 * delete asks first): start and end time as two TimeInputs, groups on a
 * TagsInput (Enter or comma adds, chips remove).
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

// Page-local layout only, tokens only. Rows, fields and chips come from the
// shared admin UI.
const SG_CSS = `
.ui-root .sg-head{display:flex;align-items:baseline;gap:var(--ui-space-2);flex-wrap:wrap}
.ui-root .sg-n{font-size:var(--ui-fs-caption);font-weight:600;color:var(--theme-text-muted)}
.ui-root .sg-t{font-size:var(--ui-fs-body);font-weight:700;color:var(--theme-text)}
.ui-root .sg-times{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ui-space-2);max-width:320px}
`;

const keyOf = (_g: ScheduleGroup, i: number) => i;
const labelOf = (_g: ScheduleGroup, i: number) => `seria ${i + 1}`;

export function ScheduleGroupsInner({ value, onChange }: InnerProps) {
  React.useInsertionEffect(() => ensureAdminUi(), []);
  // The Field label points at the "de la" input; "până la" needs its own id.
  const uid = React.useId().replace(/:/g, '');
  const [groups, setGroups] = React.useState<ScheduleGroup[]>(() =>
    Array.isArray(value) ? (value as ScheduleGroup[]) : [],
  );

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

  return (
    <div className="ui-root sg">
      <style>{SG_CSS}</style>
      <RepeatableList<ScheduleGroup>
        items={groups}
        onChange={commit}
        getKey={keyOf}
        itemLabel={labelOf}
        newItem={() => ({ timeSlot: '', courses: [] })}
        addLabel="Adaugă serie"
        emptyLabel="Nicio serie adăugată."
        aria-label="Serii"
        reorder
        confirmDelete="Seria și grupele ei dispar din program după ce salvezi pagina."
        renderRow={(group, gi, { update }) => {
          const { from, to } = splitSlot(group.timeSlot ?? '');
          const courses = group.courses ?? [];
          const setTime = (which: 'from' | 'to', val: string | null) => {
            const v = val ?? '';
            update({ timeSlot: which === 'from' ? joinSlot(v, to) : joinSlot(from, v) });
          };
          return (
            <>
              <div className="sg-head">
                <span className="sg-n">Seria {gi + 1}</span>
                <span className="sg-t ui-num">{group.timeSlot || 'fără oră'}</span>
                <span className="sg-n ui-num">
                  {courses.length} {courses.length === 1 ? 'grupă' : 'grupe'}
                </span>
              </div>
              <Field label="Interval orar">
                <div className="sg-times">
                  <TimeInput
                    value={from || null}
                    aria-label={`Seria ${gi + 1} de la`}
                    onChange={(v) => setTime('from', v)}
                  />
                  <TimeInput
                    id={`sg${uid}-${gi}-to`}
                    value={to || null}
                    aria-label={`Seria ${gi + 1} până la`}
                    onChange={(v) => setTime('to', v)}
                  />
                </div>
              </Field>
              <Field label="Grupe">
                <TagsInput
                  value={courses}
                  onChange={(next) => update({ courses: next })}
                  placeholder="Scrie o grupă și apasă Enter"
                  aria-label={`Grupele seriei ${gi + 1}`}
                />
              </Field>
            </>
          );
        }}
      />
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
    <EditorCard
      title="Serii Școala de Patinaj"
      description="Fiecare serie are un interval orar și grupele care intră pe gheață atunci. Ordinea de aici este ordinea de pe site."
    >
      <ScheduleGroupsInner value={field.value} onChange={(next) => field.onChange(name, next)} />
    </EditorCard>
  );
}
