import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface InfoSectionData {
  sectionLabel: string;
  tips: string[];
  closingLine: string;
}

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

const EMPTY: InfoSectionData = {
  sectionLabel: '',
  tips: [],
  closingLine: '',
};

export default function CursuriPageInfoSectionEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<InfoSectionData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<InfoSectionData>;
      return {
        ...EMPTY,
        ...raw,
        tips: Array.isArray(raw.tips) ? raw.tips : [],
      };
    }
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<InfoSectionData>;
      setData({
        ...EMPTY,
        ...raw,
        tips: Array.isArray(raw.tips) ? raw.tips : [],
      });
    }
  }, [field.value]);

  const commit = (next: InfoSectionData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof InfoSectionData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="cursuri-info-section-editor">
      <style>{`
        .cursuri-info-section-editor input::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .cursuri-info-section-editor textarea::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .cursuri-info-section-editor textarea { resize: vertical; font-family: inherit; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Secțiunea Informații Practice</span>
        <span style={s.groupDesc}>
          Sfaturile și regulile afișate la finalul paginii /cursuri (secțiunea Ce trebuie să știi).
        </span>
      </div>

      <div style={s.body}>
        <div style={s.sectionLabel}>Titlu secțiune</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Titlu secțiune</span>
            <span style={s.fieldHint}>ex: Ce trebuie să știi</span>
            <input
              type="text"
              value={data.sectionLabel}
              placeholder="ex: Ce trebuie să știi"
              onChange={e => update('sectionLabel', e.target.value)}
              style={{ ...s.input, width: '100%' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Sfaturi & reguli</div>
        <div style={{ padding: '4px 14px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => commit({ ...data, tips: [...data.tips, ''] })}
              style={s.addBtn}
            >
              + Adaugă sfat
            </button>
          </div>
          {data.tips.length === 0 && (
            <div style={s.emptyState}>Nicio intrare</div>
          )}
          {data.tips.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <span style={s.noteNum}>{i + 1}</span>
              <textarea
                value={item}
                rows={2}
                onChange={e => {
                  const arr = [...data.tips];
                  arr[i] = e.target.value;
                  commit({ ...data, tips: arr });
                }}
                style={{ ...s.input, height: 'auto', flex: 1 }}
              />
              <button
                type="button"
                onClick={() => commit({ ...data, tips: data.tips.filter((_, idx) => idx !== i) })}
                style={s.deleteBtn}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Linie de închidere</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Linie de închidere</span>
            <span style={s.fieldHint}>Textul final afișat după lista de sfaturi, opțional</span>
            <input
              type="text"
              value={data.closingLine}
              placeholder="ex: Ne rezervăm dreptul de a modifica orarul..."
              onChange={e => update('closingLine', e.target.value)}
              style={{ ...s.input, width: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function makeStyles(dark: boolean): Record<string, React.CSSProperties> {
  const outerBorder = dark ? '#2a2a3e' : '#d0d0e0';
  const inputBorder = dark ? '#4a4a6a' : '#c0c0d0';
  const inputBg = dark ? '#252540' : '#fff';
  const inputColor = dark ? '#e0e0f0' : '#111';

  return {
    groupWrapper: { border: `1px solid ${outerBorder}`, borderRadius: 10, overflow: 'hidden', background: dark ? '#16162a' : '#f8f8fc' },
    groupHeader: { padding: '12px 16px 10px', borderBottom: `1px solid ${outerBorder}`, background: dark ? '#1a1a30' : '#eeeef8', display: 'flex', flexDirection: 'column' as const, gap: 4 },
    groupTitle: { fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: dark ? '#9999cc' : '#4a4a88' },
    groupDesc: { fontSize: 11, color: dark ? '#666' : '#888', lineHeight: 1.5 },
    body: { display: 'flex', flexDirection: 'column' as const, background: dark ? '#1e1e2e' : '#fff' },
    sectionLabel: { padding: '10px 14px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: dark ? '#7777aa' : '#8888aa' },
    fieldRowSingle: { display: 'flex', gap: 12, padding: '4px 14px 12px' },
    fieldRowDouble: { display: 'flex', gap: 12, padding: '4px 14px 12px' },
    fieldHalf: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 3, minWidth: 0 },
    fieldFull: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 3 },
    fieldLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: dark ? '#aaa' : '#555' },
    fieldHint: { fontSize: 10, color: dark ? '#555' : '#999', lineHeight: 1.4 },
    input: { padding: '6px 9px', border: `1px solid ${inputBorder}`, borderRadius: 4, fontSize: 12, fontWeight: 500, background: inputBg, color: inputColor, outline: 'none', boxSizing: 'border-box' as const, minWidth: 0, height: 30, width: '100%' },
    divider: { height: 1, margin: '0 14px', background: dark ? '#2a2a3e' : '#e8e8f0' },
    addBtn: { padding: '3px 8px', border: `1px dashed ${dark ? '#555' : '#bbb'}`, borderRadius: 4, background: 'transparent', color: dark ? '#888' : '#666', cursor: 'pointer', fontSize: 11 },
    emptyState: { padding: '10px', textAlign: 'center' as const, fontSize: 12, color: dark ? '#444' : '#aaa', fontStyle: 'italic' },
    noteNum: { width: 18, height: 18, marginTop: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, background: dark ? '#2a2a3a' : '#e8e8f0', color: dark ? '#666' : '#999', fontSize: 10, fontWeight: 600 },
    deleteBtn: { width: 24, height: 24, marginTop: 4, padding: 0, border: '1px solid #fca5a5', borderRadius: 4, background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 },
  };
}
