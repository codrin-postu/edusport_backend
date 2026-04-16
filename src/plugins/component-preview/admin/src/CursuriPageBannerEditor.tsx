import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface BannerData {
  title: string;
  scheduleDays: string;
  scheduleTimes: string;
  locationName: string;
  locationUrl: string;
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

const EMPTY: BannerData = {
  title: '',
  scheduleDays: '',
  scheduleTimes: '',
  locationName: '',
  locationUrl: '',
};

export default function CursuriPageBannerEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<BannerData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as BannerData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as BannerData) });
  }, [field.value]);

  const commit = (next: BannerData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof BannerData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="cursuri-banner-editor">
      <style>{`
        .cursuri-banner-editor input::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Banner Pagina Cursuri</span>
        <span style={s.groupDesc}>
          Titlul și informațiile de orar afișate în header-ul paginii /cursuri.
        </span>
      </div>

      <div style={s.body}>
        <div style={s.sectionLabel}>Titlu banner</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Titlu banner</span>
            <span style={s.fieldHint}>Titlul mare afișat pe banner-ul paginii, ex: Cursuri de Patinaj</span>
            <input
              type="text"
              value={data.title}
              placeholder="ex: Cursuri de Patinaj"
              onChange={e => update('title', e.target.value)}
              style={{ ...s.input, width: '100%' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Orar și locație</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Zile de curs</span>
            <span style={s.fieldHint}>ex: Sâmbătă & Duminică</span>
            <input
              type="text"
              value={data.scheduleDays}
              placeholder="ex: Sâmbătă & Duminică"
              onChange={e => update('scheduleDays', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Ore de curs</span>
            <span style={s.fieldHint}>ex: 10:00–10:50 & 11:00–11:50</span>
            <input
              type="text"
              value={data.scheduleTimes}
              placeholder="ex: 10:00–10:50 & 11:00–11:50"
              onChange={e => update('scheduleTimes', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Locație</span>
            <span style={s.fieldHint}>Numele locației, ex: AFI Cotroceni</span>
            <input
              type="text"
              value={data.locationName}
              placeholder="ex: AFI Cotroceni"
              onChange={e => update('locationName', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Link locație</span>
            <span style={s.fieldHint}>URL Google Maps sau altă pagină a locației</span>
            <input
              type="text"
              value={data.locationUrl}
              placeholder="ex: https://maps.google.com/..."
              onChange={e => update('locationUrl', e.target.value)}
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
