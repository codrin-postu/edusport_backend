import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface AboutData {
  eyebrow: string;
  heading: string;
  content: string;
  locationBullet: string;
  levelsBullet: string;
  coachesBullet: string;
  videoUrl: string;
  videoLabel: string;
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

const EMPTY: AboutData = {
  eyebrow: '',
  heading: '',
  content: '',
  locationBullet: '',
  levelsBullet: '',
  coachesBullet: '',
  videoUrl: '',
  videoLabel: '',
};

export default function CursuriPageAboutEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<AboutData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as AboutData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as AboutData) });
  }, [field.value]);

  const commit = (next: AboutData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof AboutData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="cursuri-about-editor">
      <style>{`
        .cursuri-about-editor input::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .cursuri-about-editor textarea::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .cursuri-about-editor textarea { resize: vertical; font-family: inherit; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Secțiunea Despre Cursuri</span>
        <span style={s.groupDesc}>
          Prezentarea școlii de patinaj: titlu, text descriptiv, puncte cheie și link video opțional.
        </span>
      </div>

      <div style={s.body}>
        <div style={s.sectionLabel}>Titlu și prezentare</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Etichetă mică</span>
            <span style={s.fieldHint}>Textul mic deasupra titlului, ex: Despre noi</span>
            <input
              type="text"
              value={data.eyebrow}
              placeholder="ex: Despre noi"
              onChange={e => update('eyebrow', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Titlu secțiune</span>
            <span style={s.fieldHint}>ex: Școala de patinaj EduSport</span>
            <input
              type="text"
              value={data.heading}
              placeholder="ex: Școala de patinaj EduSport"
              onChange={e => update('heading', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Text principal</span>
            <span style={s.fieldHint}>Descrierea principală. Separă paragrafele cu o linie goală.</span>
            <textarea
              value={data.content}
              rows={5}
              placeholder="Descrierea principală a școlii..."
              onChange={e => update('content', e.target.value)}
              style={{ ...s.input, height: 'auto', padding: '8px 9px' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Puncte cheie</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Bullet locație</span>
            <span style={s.fieldHint}>ex: Patinoar AFI Cotroceni</span>
            <input
              type="text"
              value={data.locationBullet}
              placeholder="ex: Patinoar AFI Cotroceni"
              onChange={e => update('locationBullet', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Bullet niveluri</span>
            <span style={s.fieldHint}>ex: Toate nivelurile de vârstă și experiență</span>
            <input
              type="text"
              value={data.levelsBullet}
              placeholder="ex: Toate nivelurile de vârstă și experiență"
              onChange={e => update('levelsBullet', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Bullet antrenori</span>
            <span style={s.fieldHint}>ex: Antrenori cu experiență internațională</span>
            <input
              type="text"
              value={data.coachesBullet}
              placeholder="ex: Antrenori cu experiență internațională"
              onChange={e => update('coachesBullet', e.target.value)}
              style={{ ...s.input, width: '100%' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Video</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Link video</span>
            <span style={s.fieldHint}>URL YouTube sau alt video, opțional</span>
            <input
              type="text"
              value={data.videoUrl}
              placeholder="ex: https://youtube.com/watch?v=..."
              onChange={e => update('videoUrl', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Text link video</span>
            <span style={s.fieldHint}>Textul afișat pe linkul video, ex: Urmărește un curs</span>
            <input
              type="text"
              value={data.videoLabel}
              placeholder="ex: Urmărește un curs"
              onChange={e => update('videoLabel', e.target.value)}
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
