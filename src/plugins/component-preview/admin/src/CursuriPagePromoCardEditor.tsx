import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface PromoCardData {
  eyebrow: string;
  title: string;
  description: string;
  subscriptionInfoTitle: string;
  subscriptionBullets: string[];
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

const EMPTY: PromoCardData = {
  eyebrow: '',
  title: '',
  description: '',
  subscriptionInfoTitle: '',
  subscriptionBullets: [],
};

export default function CursuriPagePromoCardEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<PromoCardData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<PromoCardData>;
      return {
        ...EMPTY,
        ...raw,
        subscriptionBullets: Array.isArray(raw.subscriptionBullets) ? raw.subscriptionBullets : [],
      };
    }
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<PromoCardData>;
      setData({
        ...EMPTY,
        ...raw,
        subscriptionBullets: Array.isArray(raw.subscriptionBullets) ? raw.subscriptionBullets : [],
      });
    }
  }, [field.value]);

  const commit = (next: PromoCardData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof PromoCardData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="cursuri-promo-card-editor">
      <style>{`
        .cursuri-promo-card-editor input::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .cursuri-promo-card-editor textarea::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .cursuri-promo-card-editor textarea { resize: vertical; font-family: inherit; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Card Promo Abonament</span>
        <span style={s.groupDesc}>
          Cardul albastru care promovează abonamentul de club afișat pe pagina /cursuri.
        </span>
      </div>

      <div style={s.body}>
        <div style={s.sectionLabel}>Titlu card</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Etichetă mică</span>
            <span style={s.fieldHint}>Textul mic deasupra titlului, ex: Devino Membru</span>
            <input
              type="text"
              value={data.eyebrow}
              placeholder="ex: Devino Membru"
              onChange={e => update('eyebrow', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Titlu card</span>
            <span style={s.fieldHint}>Titlul cardului promo, ex: Abonament de Club</span>
            <input
              type="text"
              value={data.title}
              placeholder="ex: Abonament de Club"
              onChange={e => update('title', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Descriere</span>
            <span style={s.fieldHint}>Textul descriptiv al cardului promo</span>
            <textarea
              value={data.description}
              rows={3}
              placeholder="Descrierea cardului promo..."
              onChange={e => update('description', e.target.value)}
              style={{ ...s.input, height: 'auto', padding: '8px 9px' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Informații abonament</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Titlu info abonament</span>
            <span style={s.fieldHint}>Titlul listei de informații, ex: Ce include abonamentul?</span>
            <input
              type="text"
              value={data.subscriptionInfoTitle}
              placeholder="ex: Ce include abonamentul?"
              onChange={e => update('subscriptionInfoTitle', e.target.value)}
              style={{ ...s.input, width: '100%' }}
            />
          </div>
        </div>

        <div style={s.sectionLabel}>Puncte abonament</div>
        <div style={{ padding: '4px 14px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => commit({ ...data, subscriptionBullets: [...data.subscriptionBullets, ''] })}
              style={s.addBtn}
            >
              + Adaugă punct
            </button>
          </div>
          {data.subscriptionBullets.length === 0 && (
            <div style={s.emptyState}>Nicio intrare</div>
          )}
          {data.subscriptionBullets.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <span style={s.noteNum}>{i + 1}</span>
              <textarea
                value={item}
                rows={2}
                onChange={e => {
                  const arr = [...data.subscriptionBullets];
                  arr[i] = e.target.value;
                  commit({ ...data, subscriptionBullets: arr });
                }}
                style={{ ...s.input, height: 'auto', flex: 1 }}
              />
              <button
                type="button"
                onClick={() => commit({ ...data, subscriptionBullets: data.subscriptionBullets.filter((_, idx) => idx !== i) })}
                style={s.deleteBtn}
              >
                ×
              </button>
            </div>
          ))}
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
