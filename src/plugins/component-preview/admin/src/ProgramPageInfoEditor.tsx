import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface ProgramPageInfoData {
  seasonLabel: string;
  scheduleSubtitle: string;
  seasonStart: string;
  seasonEnd: string;
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

const EMPTY: ProgramPageInfoData = {
  seasonLabel: '',
  scheduleSubtitle: '',
  seasonStart: '',
  seasonEnd: '',
};

export default function ProgramPageInfoEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<ProgramPageInfoData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as ProgramPageInfoData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as ProgramPageInfoData) });
  }, [field.value]);

  const commit = (next: ProgramPageInfoData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof ProgramPageInfoData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="program-page-info-editor">
      <style>{`
        .program-page-info-editor input::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Pagina Program — Sezon</span>
        <span style={s.groupDesc}>
          Informațiile sezonului și subtitlul orarului pentru pagina /cursuri/program.
        </span>
      </div>

      <div style={s.body}>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Etichetă sezon</span>
            <span style={s.fieldHint}>ex: Sezonul 2025–2026</span>
            <input
              type="text"
              value={data.seasonLabel}
              placeholder="ex: Sezonul 2025–2026"
              onChange={e => update('seasonLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Subtitlu orar</span>
            <span style={s.fieldHint}>Textul de sub titlul secțiunii de orar</span>
            <input
              type="text"
              value={data.scheduleSubtitle}
              placeholder="ex: Cursuri în fiecare weekend"
              onChange={e => update('scheduleSubtitle', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Data început sezon</span>
            <span style={s.fieldHint}>ex: 4 octombrie 2025</span>
            <input
              type="text"
              value={data.seasonStart}
              placeholder="ex: 4 octombrie 2025"
              onChange={e => update('seasonStart', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Data sfârșit sezon</span>
            <span style={s.fieldHint}>ex: 29 martie 2026</span>
            <input
              type="text"
              value={data.seasonEnd}
              placeholder="ex: 29 martie 2026"
              onChange={e => update('seasonEnd', e.target.value)}
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
    fieldRowDouble: { display: 'flex', gap: 12, padding: '4px 14px 12px' },
    fieldHalf: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 3, minWidth: 0 },
    fieldLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: dark ? '#aaa' : '#555' },
    fieldHint: { fontSize: 10, color: dark ? '#555' : '#999', lineHeight: 1.4 },
    input: { padding: '6px 9px', border: `1px solid ${inputBorder}`, borderRadius: 4, fontSize: 12, fontWeight: 500, background: inputBg, color: inputColor, outline: 'none', boxSizing: 'border-box' as const, minWidth: 0, height: 30, width: '100%' },
  };
}
