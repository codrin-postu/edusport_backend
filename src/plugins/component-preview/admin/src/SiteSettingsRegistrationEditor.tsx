import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface RegistrationData {
  open: boolean;
  currentSeason: string;
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

const EMPTY: RegistrationData = {
  open: false,
  currentSeason: '',
};

export default function SiteSettingsRegistrationEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<RegistrationData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as RegistrationData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as RegistrationData) });
  }, [field.value]);

  const commit = (next: RegistrationData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof RegistrationData, val: string | boolean) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="ss-reg-editor">
      <style>{`
        .ss-reg-editor input::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Înscrieri & Sezon</span>
        <span style={s.groupDesc}>
          Controlează starea înscrierilor și informațiile sezonului curent.
        </span>
      </div>

      <div style={s.body}>
        {/* Toggle */}
        <div style={s.fieldRow}>
          <div style={s.fieldGroup}>
            <span style={s.fieldLabel}>Înscrieri deschise</span>
            <span style={s.fieldHint}>Când este activ, pe site se afișează secțiunea de înscrieri. Când este inactiv, apare mesajul că înscrierile sunt închise.</span>
          </div>
          <button
            type="button"
            onClick={() => update('open', !data.open)}
            style={data.open ? { ...s.toggle, ...s.toggleOn } : { ...s.toggle, ...s.toggleOff }}
          >
            {data.open ? 'DA' : 'NU'}
          </button>
        </div>

        <div style={s.divider} />

        {/* Season */}
        <div style={s.fieldRow}>
          <div style={s.fieldGroup}>
            <span style={s.fieldLabel}>Sezon curent</span>
            <span style={s.fieldHint}>Ex: „2025–2026". Apare în mai multe locuri pe site.</span>
          </div>
          <input
            type="text"
            value={data.currentSeason}
            placeholder="ex: 2025–2026"
            onChange={e => update('currentSeason', e.target.value)}
            style={s.input}
          />
        </div>

      </div>
    </div>
  );
}

function makeStyles(dark: boolean): Record<string, React.CSSProperties> {
  const outerBorder = dark ? '#2a2a3e' : '#d0d0e0';
  const border = dark ? '#333340' : '#e0e0e8';
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
      gap: 0,
      background: dark ? '#1e1e2e' : '#fff',
    },
    fieldRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: `1px solid ${border}`,
    },
    fieldGroup: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 2,
      minWidth: 0,
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
    },
    toggle: {
      padding: '4px 14px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 700,
      cursor: 'pointer',
      border: 'none',
      letterSpacing: '0.05em',
      flexShrink: 0,
    },
    toggleOn: {
      background: dark ? '#1a3a1a' : '#dcfce7',
      color: dark ? '#4ade80' : '#166534',
    },
    toggleOff: {
      background: dark ? '#3a1a1a' : '#fee2e2',
      color: dark ? '#f87171' : '#991b1b',
    },
    divider: {
      height: 1,
      background: dark ? '#2a2a3e' : '#e8e8f0',
    },
  };
}
