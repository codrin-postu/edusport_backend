import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface AboutData {
  eyebrow: string;
  heading: string;
  body: string;
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

const EMPTY: AboutData = {
  eyebrow: '',
  heading: '',
  body: '',
  ctaLabel: '',
  ctaUrl: '',
};

export default function HomepageAboutEditor({ name }: Props) {
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
    <div style={s.groupWrapper} className="hp-about-editor">
      <style>{`
        .hp-about-editor input::placeholder,
        .hp-about-editor textarea::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .hp-about-editor textarea { resize: vertical; font-family: inherit; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Secțiunea Cine Suntem</span>
        <span style={s.groupDesc}>
          Secțiunea de prezentare a asociației de pe pagina principală. Include un scurt text descriptiv și un link spre pagina Despre noi.
        </span>
      </div>

      <div style={s.body}>
        <div style={s.sectionLabel}>Titlu și subtitlu</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Etichetă mică (eyebrow)</span>
            <span style={s.fieldHint}>Textul mic deasupra titlului, ex: Cine suntem</span>
            <input
              type="text"
              value={data.eyebrow}
              placeholder="ex: Cine suntem"
              onChange={e => update('eyebrow', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Titlu principal</span>
            <span style={s.fieldHint}>Titlul secțiunii, ex: Asociație non-profit pentru sport și educație</span>
            <input
              type="text"
              value={data.heading}
              placeholder="ex: Asociație non-profit pentru sport și educație"
              onChange={e => update('heading', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Conținut text</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Text secțiune</span>
            <span style={s.fieldHint}>Descrierea asociației. Separă paragrafele cu o linie goală.</span>
            <textarea
              value={data.body}
              rows={5}
              placeholder="ex: ACS EduSport Reșița este o asociație sportivă non-profit..."
              onChange={e => update('body', e.target.value)}
              style={{ ...s.input, height: 'auto', padding: '8px 9px' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Link de acțiune</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Text link</span>
            <span style={s.fieldHint}>Textul linkului/butonului</span>
            <input
              type="text"
              value={data.ctaLabel}
              placeholder="ex: Despre noi"
              onChange={e => update('ctaLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Destinație link</span>
            <span style={s.fieldHint}>Pagina spre care duce, ex: /despre-noi/istoric</span>
            <input
              type="text"
              value={data.ctaUrl}
              placeholder="ex: /despre-noi/istoric"
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
    groupWrapper: {
      border: `1px solid ${outerBorder}`,
      borderRadius: 10,
      overflow: 'hidden',
      background: dark ? '#16162a' : '#f8f8fc',
    },
    groupHeader: {
      padding: '12px 16px 10px',
      borderBottom: `1px solid ${outerBorder}`,
      background: dark ? '#1a1a30' : '#eeeef8',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
    },
    groupTitle: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: dark ? '#9999cc' : '#4a4a88',
    },
    groupDesc: {
      fontSize: 11,
      color: dark ? '#666' : '#888',
      lineHeight: 1.5,
    },
    body: {
      display: 'flex',
      flexDirection: 'column' as const,
      background: dark ? '#1e1e2e' : '#fff',
    },
    sectionLabel: {
      padding: '10px 14px 4px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      color: dark ? '#7777aa' : '#8888aa',
    },
    fieldRowSingle: {
      display: 'flex',
      gap: 12,
      padding: '4px 14px 12px',
    },
    fieldRowDouble: {
      display: 'flex',
      gap: 12,
      padding: '4px 14px 12px',
    },
    fieldHalf: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 3,
      minWidth: 0,
    },
    fieldFull: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 3,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.04em',
      color: dark ? '#aaa' : '#555',
    },
    fieldHint: {
      fontSize: 10,
      color: dark ? '#555' : '#999',
      lineHeight: 1.4,
    },
    input: {
      padding: '6px 9px',
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
      background: inputBg,
      color: inputColor,
      outline: 'none',
      boxSizing: 'border-box' as const,
      minWidth: 0,
      height: 30,
      width: '100%',
    },
    divider: {
      height: 1,
      margin: '0 14px',
      background: dark ? '#2a2a3e' : '#e8e8f0',
    },
  };
}
