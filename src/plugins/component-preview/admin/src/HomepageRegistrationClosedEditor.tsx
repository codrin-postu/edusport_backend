import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface RegistrationClosedData {
  seasonLabel: string;
  heading: string;
  body: string;
  whatsappLabel: string;
  whatsappUrl: string;
  contactLabel: string;
  contactUrl: string;
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

const EMPTY: RegistrationClosedData = {
  seasonLabel: '',
  heading: '',
  body: '',
  whatsappLabel: '',
  whatsappUrl: '',
  contactLabel: '',
  contactUrl: '',
};

export default function HomepageRegistrationClosedEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<RegistrationClosedData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, ...(v as RegistrationClosedData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as RegistrationClosedData) });
  }, [field.value]);

  const commit = (next: RegistrationClosedData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof RegistrationClosedData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="hp-reg-closed-editor">
      <style>{`
        .hp-reg-closed-editor input::placeholder,
        .hp-reg-closed-editor textarea::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .hp-reg-closed-editor textarea { resize: vertical; font-family: inherit; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Secțiunea Înscrieri Închise</span>
        <span style={s.groupDesc}>
          Afișată când înscrierile sunt închise (controlat din Setări Site). Anunță vizitatorii că sezonul s-a terminat și îi invită să rămână conectați.
        </span>
      </div>

      <div style={s.body}>
        <div style={s.sectionLabel}>Titlu și sezon</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Etichetă sezon</span>
            <span style={s.fieldHint}>Sezonul afișat deasupra titlului, ex: Sezonul 2025–2026</span>
            <input
              type="text"
              value={data.seasonLabel}
              placeholder="ex: Sezonul 2025–2026"
              onChange={e => update('seasonLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Titlu secțiune</span>
            <span style={s.fieldHint}>Mesajul principal, ex: Ne vedem în următorul sezon!</span>
            <input
              type="text"
              value={data.heading}
              placeholder="ex: Ne vedem în următorul sezon!"
              onChange={e => update('heading', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Mesaj pentru vizitatori</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Text informativ</span>
            <span style={s.fieldHint}>Mesajul afișat vizitatorilor când înscrierile sunt închise. Separă paragrafele cu o linie goală.</span>
            <textarea
              value={data.body}
              rows={4}
              placeholder="ex: Mulțumim tuturor celor care s-au alăturat în acest sezon..."
              onChange={e => update('body', e.target.value)}
              style={{ ...s.input, height: 'auto', padding: '8px 9px' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.sectionLabel}>Butoane de contact</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Text buton WhatsApp</span>
            <span style={s.fieldHint}>ex: Alătură-te pe WhatsApp</span>
            <input
              type="text"
              value={data.whatsappLabel}
              placeholder="ex: Alătură-te pe WhatsApp"
              onChange={e => update('whatsappLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Link WhatsApp</span>
            <span style={s.fieldHint}>ex: https://wa.me/40700000000</span>
            <input
              type="text"
              value={data.whatsappUrl}
              placeholder="ex: https://wa.me/40700000000"
              onChange={e => update('whatsappUrl', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Text link contact</span>
            <span style={s.fieldHint}>ex: Contactează-ne</span>
            <input
              type="text"
              value={data.contactLabel}
              placeholder="ex: Contactează-ne"
              onChange={e => update('contactLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Link pagina contact</span>
            <span style={s.fieldHint}>ex: /contact</span>
            <input
              type="text"
              value={data.contactUrl}
              placeholder="ex: /contact"
              onChange={e => update('contactUrl', e.target.value)}
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
