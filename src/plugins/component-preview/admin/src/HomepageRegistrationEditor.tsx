import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface RegistrationData {
  seasonLabel: string;
  heading: string;
  body: string;
  bodySecondary: string;
  scheduleDays: string;
  scheduleTimes: string;
  locationName: string;
  ctaPrimaryLabel: string;
  ctaPrimaryUrl: string;
  ctaSecondaryLabel: string;
  ctaSecondaryUrl: string;
  pricesLinkLabel: string;
  pricesLinkUrl: string;
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
  seasonLabel: '',
  heading: '',
  body: '',
  bodySecondary: '',
  scheduleDays: '',
  scheduleTimes: '',
  locationName: '',
  ctaPrimaryLabel: '',
  ctaPrimaryUrl: '',
  ctaSecondaryLabel: '',
  ctaSecondaryUrl: '',
  pricesLinkLabel: '',
  pricesLinkUrl: '',
};

export default function HomepageRegistrationEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<RegistrationData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, ...(v as RegistrationData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as RegistrationData) });
  }, [field.value]);

  const commit = (next: RegistrationData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof RegistrationData, val: string) => {
    commit({ ...data, [key]: val });
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper} className="hp-reg-editor">
      <style>{`
        .hp-reg-editor input::placeholder,
        .hp-reg-editor textarea::placeholder { color: ${dark ? '#555' : '#bbb'}; font-style: italic; }
        .hp-reg-editor textarea { resize: vertical; font-family: inherit; }
      `}</style>
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Secțiunea Înscrieri (Sezon Activ)</span>
        <span style={s.groupDesc}>
          Afișată când înscrierile sunt deschise (controlat din Setări Site). Conține detalii despre sezon, orar, locație și butoane de acțiune.
        </span>
      </div>

      <div style={s.body}>
        {/* Sezon & Titlu */}
        <div style={s.sectionLabel}>Titlu și sezon</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Etichetă sezon</span>
            <span style={s.fieldHint}>Afișat deasupra titlului, ex: Sezonul 2025–2026</span>
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
            <span style={s.fieldHint}>Mesajul principal, ex: Sezonul a început!</span>
            <input
              type="text"
              value={data.heading}
              placeholder="ex: Sezonul a început!"
              onChange={e => update('heading', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Texte */}
        <div style={s.sectionLabel}>Texte informative</div>
        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Text principal</span>
            <span style={s.fieldHint}>Textul principal al secțiunii. Separă paragrafele cu o linie goală.</span>
            <textarea
              value={data.body}
              rows={4}
              placeholder="ex: Suntem bucuroși să anunțăm că înscrierile pentru sezonul 2025–2026 sunt deschise..."
              onChange={e => update('body', e.target.value)}
              style={{ ...s.input, height: 'auto', padding: '8px 9px' }}
            />
          </div>
        </div>

        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Text secundar</span>
            <span style={s.fieldHint}>Text opțional afișat mai jos (ex: condiții suplimentare)</span>
            <textarea
              value={data.bodySecondary}
              rows={3}
              placeholder="ex: Locurile sunt limitate. Înscrierea se face în ordinea solicitărilor."
              onChange={e => update('bodySecondary', e.target.value)}
              style={{ ...s.input, height: 'auto', padding: '8px 9px' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Orar */}
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

        <div style={s.fieldRowSingle}>
          <div style={s.fieldFull}>
            <span style={s.fieldLabel}>Locație</span>
            <span style={s.fieldHint}>Numele locației unde se desfășoară cursurile, ex: AFI Cotroceni</span>
            <input
              type="text"
              value={data.locationName}
              placeholder="ex: AFI Cotroceni"
              onChange={e => update('locationName', e.target.value)}
              style={{ ...s.input, width: '50%' }}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Butoane */}
        <div style={s.sectionLabel}>Butoane principale</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Text buton primar</span>
            <span style={s.fieldHint}>ex: Înscrie-te</span>
            <input
              type="text"
              value={data.ctaPrimaryLabel}
              placeholder="ex: Înscrie-te"
              onChange={e => update('ctaPrimaryLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Link buton primar</span>
            <span style={s.fieldHint}>ex: /inscrieri</span>
            <input
              type="text"
              value={data.ctaPrimaryUrl}
              placeholder="ex: /inscrieri"
              onChange={e => update('ctaPrimaryUrl', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Text buton secundar</span>
            <span style={s.fieldHint}>ex: Află mai mult</span>
            <input
              type="text"
              value={data.ctaSecondaryLabel}
              placeholder="ex: Află mai mult"
              onChange={e => update('ctaSecondaryLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Link buton secundar</span>
            <span style={s.fieldHint}>ex: /inscrieri</span>
            <input
              type="text"
              value={data.ctaSecondaryUrl}
              placeholder="ex: /inscrieri"
              onChange={e => update('ctaSecondaryUrl', e.target.value)}
              style={s.input}
            />
          </div>
        </div>

        <div style={s.divider} />

        {/* Link prețuri */}
        <div style={s.sectionLabel}>Link prețuri</div>
        <div style={s.fieldRowDouble}>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Text link prețuri</span>
            <span style={s.fieldHint}>ex: Vezi prețurile</span>
            <input
              type="text"
              value={data.pricesLinkLabel}
              placeholder="ex: Vezi prețurile"
              onChange={e => update('pricesLinkLabel', e.target.value)}
              style={s.input}
            />
          </div>
          <div style={s.fieldHalf}>
            <span style={s.fieldLabel}>Link spre prețuri</span>
            <span style={s.fieldHint}>ex: /inscrieri#preturi</span>
            <input
              type="text"
              value={data.pricesLinkUrl}
              placeholder="ex: /inscrieri#preturi"
              onChange={e => update('pricesLinkUrl', e.target.value)}
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
