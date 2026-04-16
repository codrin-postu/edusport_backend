import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface ContactData {
  phone: string;
  email: string;
  facebookUrl1: string;
  instagramUrl: string;
  whatsappChannelUrl: string;
  addressDisplay: string;
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

const EMPTY: ContactData = {
  phone: '',
  email: '',
  facebookUrl1: '',
  instagramUrl: '',
  whatsappChannelUrl: '',
  addressDisplay: '',
};

export default function SiteSettingsContactEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<ContactData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as ContactData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as ContactData) });
  }, [field.value]);

  const commit = (next: ContactData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof ContactData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="ss-contact-editor">
      <style>{`
        .ss-contact-editor input::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Date de Contact & Rețele Sociale</span>
        <span style={s.groupDesc}>
          Informații afișate în footer-ul site-ului și pe paginile de contact. Modificările se reflectă pe tot site-ul.
        </span>
      </div>

      <div style={s.body}>
        {/* Phone section */}
        <div style={s.sectionLabel}>Telefon</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Număr telefon</span>
            <span style={s.fieldHint}>Cu sau fără spații — link-ul tel: se generează automat</span>
            <input
              type="text"
              value={data.phone}
              placeholder="ex: 0723 623 712"
              onChange={e => update('phone', e.target.value)}
              style={{ ...s.input, width: '100%' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Email */}
        <div style={s.sectionLabel}>Email</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Adresă email</span>
            <input
              type="email"
              value={data.email}
              placeholder="ex: scoala.de.patinaj@gmail.com"
              onChange={e => update('email', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Social */}
        <div style={s.sectionLabel}>Rețele Sociale</div>
        <div style={s.fieldRow}>
          <span style={s.fieldLabel}>Facebook</span>
          <input
            type="text"
            value={data.facebookUrl1}
            placeholder="ex: https://facebook.com/edusport"
            onChange={e => update('facebookUrl1', e.target.value)}
            style={s.input}
          />
        </div>

        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Instagram</span>
            <input
              type="text"
              value={data.instagramUrl}
              placeholder="ex: https://instagram.com/edusport"
              onChange={e => update('instagramUrl', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Canal WhatsApp</span>
            <span style={s.fieldHint}>Link către canalul de WhatsApp</span>
            <input
              type="text"
              value={data.whatsappChannelUrl}
              placeholder="ex: https://whatsapp.com/channel/..."
              onChange={e => update('whatsappChannelUrl', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Address */}
        <div style={s.sectionLabel}>Adresă</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Adresă afișată</span>
            <span style={s.fieldHint}>Textul adresei care apare pe site</span>
            <input
              type="text"
              value={data.addressDisplay}
              placeholder="ex: Patinoarul AFI Cotroceni, București"
              onChange={e => update('addressDisplay', e.target.value)}
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
    },
    divider: {
      height: 1,
      margin: '0 14px',
      background: dark ? '#2a2a3e' : '#e8e8f0',
    },
  };
}
