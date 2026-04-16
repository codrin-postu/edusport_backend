import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface AnnouncementData {
  message: string;
  type: string;
  ctaLabel: string;
  ctaUrl: string;
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

const EMPTY: AnnouncementData = {
  message: '',
  type: 'info',
  ctaLabel: '',
  ctaUrl: '',
};

const TYPE_OPTIONS = [
  { value: 'info', label: 'Info', color: '#3b82f6' },
  { value: 'warning', label: 'Avertisment', color: '#f59e0b' },
  { value: 'success', label: 'Succes', color: '#22c55e' },
  { value: 'error', label: 'Eroare', color: '#ef4444' },
];

export default function AnnouncementEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<AnnouncementData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as AnnouncementData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as AnnouncementData) });
  }, [field.value]);

  const commit = (next: AnnouncementData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof AnnouncementData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="announcement-editor">
      <style>{`
        .announcement-editor input::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .announcement-editor textarea::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .announcement-editor textarea { resize: vertical; font-family: inherit; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Conținut Anunț Popup</span>
        <span style={s.groupDesc}>
          Mesajul și butonul de acțiune afișate în popup-ul de anunț. Activarea/dezactivarea se face din câmpurile de mai sus.
        </span>
      </div>

      <div style={s.body}>
        <div style={s.sectionLabel}>Mesaj</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Mesaj anunț</span>
            <span style={s.fieldHint}>Textul principal afișat în popup-ul de anunț</span>
            <textarea
              value={data.message}
              rows={4}
              placeholder="Textul anunțului..."
              onChange={e => update('message', e.target.value)}
              style={{ ...s.input, height: 'auto', padding: '8px 9px' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Tip anunț</div>
        <div style={{ padding: '4px 14px 12px' }}>
          <span style={s.fieldHint}>Determină culoarea și iconița popup-ului</span>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {TYPE_OPTIONS.map(opt => {
              const selected = data.type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('type', opt.value)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 14,
                    border: `2px solid ${selected ? opt.color : (dark ? '#333' : '#ddd')}`,
                    background: selected ? (dark ? `${opt.color}22` : `${opt.color}18`) : 'transparent',
                    color: selected ? opt.color : (dark ? '#888' : '#666'),
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: selected ? 700 : 500,
                    letterSpacing: '0.02em',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Buton de acțiune (opțional)</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Text buton</span>
            <span style={s.fieldHint}>Textul butonului de acțiune, opțional</span>
            <input
              type="text"
              value={data.ctaLabel}
              placeholder="ex: Înscrie-te acum"
              onChange={e => update('ctaLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Link buton</span>
            <span style={s.fieldHint}>Destinația butonului, ex: /inscrieri</span>
            <input
              type="text"
              value={data.ctaUrl}
              placeholder="ex: /inscrieri"
              onChange={e => update('ctaUrl', e.target.value)}
              style={s.input}
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
  };
}
