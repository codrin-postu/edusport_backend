import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Trash, Plus } from '@strapi/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduleGroup {
  timeSlot: string;
  schedule?: string;
  duration?: string;
  courses: string[];
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// useDark hook
// ---------------------------------------------------------------------------

function useDark() {
  const [dark, setDark] = React.useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );
  React.useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark'),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ScheduleGroupsEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [groups, setGroups] = React.useState<ScheduleGroup[]>(() =>
    Array.isArray(field.value) ? (field.value as ScheduleGroup[]) : [],
  );

  React.useEffect(() => {
    if (Array.isArray(field.value)) setGroups(field.value as ScheduleGroup[]);
  }, [field.value]);

  const commit = (next: ScheduleGroup[]) => {
    setGroups(next);
    field.onChange(name, next);
  };

  const addGroup = () => {
    commit([...groups, { timeSlot: '', schedule: '', duration: '50 minute', courses: [''] }]);
  };

  const removeGroup = (i: number) => {
    commit(groups.filter((_, idx) => idx !== i));
  };

  const updateGroup = (i: number, patch: Partial<ScheduleGroup>) => {
    commit(groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  };

  const addCourse = (groupIdx: number) => {
    const g = groups[groupIdx];
    updateGroup(groupIdx, { courses: [...g.courses, ''] });
  };

  const removeCourse = (groupIdx: number, courseIdx: number) => {
    const g = groups[groupIdx];
    updateGroup(groupIdx, { courses: g.courses.filter((_, i) => i !== courseIdx) });
  };

  const updateCourse = (groupIdx: number, courseIdx: number, val: string) => {
    const g = groups[groupIdx];
    updateGroup(groupIdx, {
      courses: g.courses.map((c, i) => (i === courseIdx ? val : c)),
    });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.wrapper}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerTitle}>Grupe orar</span>
        <span style={s.headerDesc}>
          Fiecare grupă are un interval orar, o zi/perioadă și lista de grupe de cursanți.
        </span>
      </div>

      <div style={s.body}>
        {groups.length === 0 && (
          <div style={s.emptyState}>Nicio grupă adăugată</div>
        )}

        {groups.map((group, gi) => (
          <div key={gi} style={{ ...s.groupCard, ...(gi % 2 === 1 ? s.groupCardAlt : {}) }}>
            {/* Group header row */}
            <div style={s.groupTopRow}>
              <span style={s.groupIndex}>#{gi + 1}</span>

              {/* Time slot */}
              <div style={s.fieldBlock}>
                <span style={s.fieldLabel}>Interval orar</span>
                <input
                  type="text"
                  value={group.timeSlot}
                  placeholder="ex: 10:00 - 10:50"
                  onChange={(e) => updateGroup(gi, { timeSlot: e.target.value })}
                  style={{ ...s.input, ...s.inputTimeSlot, ...(!group.timeSlot ? s.inputError : {}) }}
                />
              </div>

              {/* Schedule (days) */}
              <div style={s.fieldBlock}>
                <span style={s.fieldLabel}>Zile</span>
                <input
                  type="text"
                  value={group.schedule ?? ''}
                  placeholder="ex: Sâmbătă și Duminică"
                  onChange={(e) => updateGroup(gi, { schedule: e.target.value })}
                  style={s.input}
                />
              </div>

              {/* Duration */}
              <div style={{ ...s.fieldBlock, flex: 'none', minWidth: 110 }}>
                <span style={s.fieldLabel}>Durată</span>
                <input
                  type="text"
                  value={group.duration ?? ''}
                  placeholder="ex: 50 minute"
                  onChange={(e) => updateGroup(gi, { duration: e.target.value })}
                  style={s.input}
                />
              </div>

              <button
                type="button"
                onClick={() => removeGroup(gi)}
                style={s.deleteBtn}
                title="Șterge grupă"
              >
                <Trash style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* Courses list */}
            <div style={s.coursesSection}>
              <span style={s.coursesLabel}>Grupe cursanți</span>
              <div style={s.coursesList}>
                {group.courses.map((course, ci) => (
                  <div key={ci} style={s.courseRow}>
                    <span style={s.courseBullet}>—</span>
                    <input
                      type="text"
                      value={course}
                      placeholder="ex: Primii Pași"
                      onChange={(e) => updateCourse(gi, ci, e.target.value)}
                      style={{ ...s.input, flex: 1, ...(!course ? s.inputError : {}) }}
                    />
                    <button
                      type="button"
                      onClick={() => removeCourse(gi, ci)}
                      style={s.deleteCourseBtn}
                      title="Șterge grupă"
                      disabled={group.courses.length <= 1}
                    >
                      <Trash style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addCourse(gi)} style={s.addCourseBtn}>
                  <Plus style={{ width: 11, height: 11 }} />
                  Adaugă grupă
                </button>
              </div>
            </div>
          </div>
        ))}

        <div style={s.footer}>
          <button type="button" onClick={addGroup} style={s.addGroupBtn}>
            + Adaugă interval orar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(dark: boolean): Record<string, React.CSSProperties> {
  const outerBorder = dark ? '#2a2a3e' : '#d0d0e0';
  const innerBorder = dark ? '#333340' : '#e0e0e8';
  const bg = dark ? '#1e1e2e' : '#fff';
  const subtle = dark ? '#666' : '#999';
  const inputBorder = dark ? '#4a4a6a' : '#c0c0d0';
  const inputBg = dark ? '#252540' : '#fff';
  const inputColor = dark ? '#e0e0f0' : '#111';

  return {
    wrapper: {
      border: `1px solid ${outerBorder}`,
      borderRadius: 10,
      overflow: 'hidden',
      background: dark ? '#16162a' : '#f8f8fc',
    },
    header: {
      padding: '12px 16px 10px',
      borderBottom: `1px solid ${outerBorder}`,
      background: dark ? '#1a1a30' : '#eeeef8',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
    },
    headerTitle: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: dark ? '#9999cc' : '#4a4a88',
    },
    headerDesc: {
      fontSize: 11,
      color: dark ? '#888' : '#666',
      lineHeight: 1.6,
    },
    body: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    emptyState: {
      padding: '20px',
      textAlign: 'center' as const,
      fontSize: 12,
      color: subtle,
      fontStyle: 'italic',
      background: bg,
    },
    groupCard: {
      padding: '12px 14px',
      borderBottom: `1px solid ${innerBorder}`,
      background: bg,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 10,
    },
    groupCardAlt: {
      background: dark ? '#191927' : '#fafafa',
    },
    groupTopRow: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      flexWrap: 'wrap' as const,
    },
    groupIndex: {
      fontSize: 11,
      fontWeight: 700,
      color: dark ? '#5555aa' : '#aaaadd',
      paddingBottom: 6,
      flexShrink: 0,
      alignSelf: 'flex-end',
    },
    fieldBlock: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 3,
      flex: 1,
      minWidth: 120,
    },
    fieldLabel: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color: subtle,
    },
    input: {
      padding: '5px 8px',
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      fontSize: 12,
      background: inputBg,
      color: inputColor,
      outline: 'none',
      boxSizing: 'border-box' as const,
      height: 28,
      minWidth: 0,
      fontFamily: 'inherit',
      width: '100%',
    },
    inputTimeSlot: {
      fontWeight: 700,
      letterSpacing: '0.02em',
    },
    inputError: {
      border: '1px solid #ef4444',
      background: dark ? '#2a1010' : '#fff5f5',
    },
    deleteBtn: {
      width: 26,
      height: 26,
      padding: 0,
      border: '1px solid #fca5a5',
      borderRadius: 4,
      background: 'transparent',
      color: '#ef4444',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      alignSelf: 'flex-end',
      marginBottom: 1,
    },
    coursesSection: {
      paddingLeft: 28,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
    },
    coursesLabel: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color: dark ? '#5555aa' : '#aaaadd',
    },
    coursesList: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
    },
    courseRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    courseBullet: {
      fontSize: 13,
      color: subtle,
      flexShrink: 0,
      width: 14,
      textAlign: 'center' as const,
    },
    deleteCourseBtn: {
      width: 22,
      height: 22,
      padding: 0,
      border: `1px solid ${dark ? '#3a3a3a' : '#e0e0e0'}`,
      borderRadius: 3,
      background: 'transparent',
      color: dark ? '#666' : '#bbb',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    addCourseBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      border: `1px dashed ${dark ? '#444' : '#c0c0c0'}`,
      borderRadius: 4,
      background: 'transparent',
      color: dark ? '#777' : '#888',
      cursor: 'pointer',
      fontSize: 11,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    footer: {
      padding: '10px 14px',
      borderTop: `1px solid ${innerBorder}`,
      background: dark ? '#191928' : '#f7f7fc',
    },
    addGroupBtn: {
      padding: '5px 12px',
      border: `1px dashed ${dark ? '#555' : '#bbb'}`,
      borderRadius: 5,
      background: 'transparent',
      color: dark ? '#888' : '#666',
      cursor: 'pointer',
      fontSize: 12,
    },
  };
}
