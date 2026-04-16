import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Trash } from '@strapi/icons';

interface Rule {
  label: string;
  text: string;
  highlight: boolean;
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

function useDark() {
  const [dark, setDark] = React.useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );
  React.useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export default function RulesTable({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const fieldRules: Rule[] = Array.isArray(field.value) ? field.value : [];
  const [localRules, setLocalRules] = React.useState<Rule[]>(fieldRules);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const isDragging = React.useRef(false);
  const dragFrom = React.useRef<number | null>(null);
  const dragTo = React.useRef<number | null>(null);

  // Sync local rules when field value changes externally (e.g. initial load)
  React.useEffect(() => {
    if (!isDragging.current) {
      setLocalRules(Array.isArray(field.value) ? field.value : []);
    }
  }, [field.value]);

  const commit = (rules: Rule[]) => {
    setLocalRules(rules);
    field.onChange(name, rules);
  };

  const update = (index: number, key: keyof Rule, value: Rule[keyof Rule]) => {
    commit(localRules.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  };

  const addRow = () => {
    const next = [...localRules, { label: '', text: '', highlight: false }];
    commit(next);
    setExpanded(prev => new Set(prev).add(next.length - 1));
  };

  const removeRow = (index: number) => {
    commit(localRules.filter((_, i) => i !== index));
    setExpanded(prev => {
      const s = new Set<number>();
      prev.forEach(n => { if (n < index) s.add(n); else if (n > index) s.add(n - 1); });
      return s;
    });
  };

  const toggleExpand = (index: number) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(index) ? s.delete(index) : s.add(index);
      return s;
    });
  };

  // Drag handlers — only the handle div initiates drag
  const onHandleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    isDragging.current = true;
    dragFrom.current = index;
    dragTo.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const onCardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const from = dragFrom.current;
    if (from === null || from === index) return;
    if (dragTo.current === index) return;
    dragTo.current = index;
    const arr = [...localRules];
    const [moved] = arr.splice(from, 1);
    arr.splice(index, 0, moved);
    dragFrom.current = index;
    setLocalRules(arr);
  };

  const onCardDragEnd = () => {
    isDragging.current = false;
    field.onChange(name, localRules);
    dragFrom.current = null;
    dragTo.current = null;
  };

  const s = makeStyles(dark);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {localRules.map((rule, i) => {
        const isExpanded = expanded.has(i);
        const isBeingDragged = isDragging.current && dragFrom.current === i;
        return (
          <div
            key={i}
            onDragOver={(e) => onCardDragOver(e, i)}
            onDragEnd={onCardDragEnd}
            style={{
              ...(rule.highlight ? { ...s.card, ...s.cardHighlight } : s.card),
              opacity: isBeingDragged ? 0.4 : 1,
            }}
          >
            {/* Header row — always visible */}
            <div style={s.topRow}>
              {/* Drag handle — only this is draggable */}
              <div
                draggable
                onDragStart={(e) => onHandleDragStart(e, i)}
                style={s.dragHandle}
                title="Trage pentru a reordona"
              >
                ⠿
              </div>

              <span style={s.numBadge}>{i + 1}</span>

              <span style={s.labelText}>{rule.label || <em style={{ opacity: 0.4 }}>Fără titlu</em>}</span>

              {rule.highlight && (
                <span style={s.highlightBadge}>★</span>
              )}

              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={() => toggleExpand(i)}
                  style={s.iconBtn}
                  title={isExpanded ? 'Restrânge' : 'Extinde'}
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  style={s.deleteBtn}
                  title="Șterge regulă"
                >
                  <Trash style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: `1px solid ${dark ? '#2a2a3a' : '#f0f0f5'}` }}>
                <input
                  type="text"
                  value={rule.label}
                  placeholder="Etichetă scurtă…"
                  onChange={e => update(i, 'label', e.target.value)}
                  style={s.labelInput}
                />
                <textarea
                  value={rule.text}
                  rows={3}
                  placeholder="Textul complet al regulii…"
                  onChange={e => update(i, 'text', e.target.value)}
                  style={s.textarea}
                />
                <label style={s.highlightLabel} title="Evidențiază această regulă">
                  <input
                    type="checkbox"
                    checked={rule.highlight}
                    onChange={e => update(i, 'highlight', e.target.checked)}
                    style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 11, color: dark ? '#999' : '#888' }}>
                    Evidențiază regulă
                  </span>
                </label>
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={addRow} style={s.addBtn}>
        + Adaugă regulă
      </button>
    </div>
  );
}

function makeStyles(dark: boolean): Record<string, React.CSSProperties> {
  const border = dark ? '#333340' : '#e0e0e8';
  const inputBorder = dark ? '#3a3a4a' : '#ddd';
  const bg = dark ? '#1e1e2e' : '#fff';
  const inputBg = dark ? '#252535' : 'transparent';
  const color = dark ? '#e0e0f0' : 'inherit';

  return {
    card: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '6px 8px',
      border: `1px solid ${border}`,
      borderRadius: 6,
      background: bg,
      color,
    },
    cardHighlight: {
      background: dark ? '#2a2510' : '#fffbeb',
      borderColor: dark ? '#7a6820' : '#f6d860',
    },
    topRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    dragHandle: {
      fontSize: 16,
      color: dark ? '#555' : '#bbb',
      cursor: 'grab',
      userSelect: 'none',
      flexShrink: 0,
      lineHeight: 1,
      padding: '2px 4px',
    },
    numBadge: {
      width: 22,
      height: 22,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
      background: dark ? '#2a2a3a' : '#f0f0f5',
      color: dark ? '#888' : '#aaa',
      fontSize: 11,
      fontWeight: 600,
      userSelect: 'none',
    },
    labelText: {
      flex: 1,
      fontSize: 13,
      fontWeight: 500,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color,
    },
    highlightBadge: {
      fontSize: 11,
      color: dark ? '#c9a83c' : '#d4a017',
      flexShrink: 0,
    },
    iconBtn: {
      width: 26,
      height: 26,
      padding: 0,
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      background: 'transparent',
      color: dark ? '#666' : '#aaa',
      cursor: 'pointer',
      fontSize: 10,
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
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    labelInput: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '4px 8px',
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      fontSize: 13,
      background: inputBg,
      color,
      outline: 'none',
    },
    highlightLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      cursor: 'pointer',
      userSelect: 'none',
    },
    textarea: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '6px 8px',
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      fontSize: 13,
      lineHeight: 1.6,
      resize: 'vertical',
      background: inputBg,
      color,
      outline: 'none',
      fontFamily: 'inherit',
      minHeight: 64,
    },
    addBtn: {
      padding: '7px 14px',
      border: `1px dashed ${dark ? '#555' : '#bbb'}`,
      borderRadius: 4,
      background: 'transparent',
      color: dark ? '#888' : '#666',
      cursor: 'pointer',
      fontSize: 13,
      alignSelf: 'flex-start',
    },
  };
}
