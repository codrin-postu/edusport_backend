import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Trash } from '@strapi/icons';

interface Tier {
  label: string;
  price: string;
  tooltip?: string;
  note?: string;
}

interface PricingData {
  memberTiers: Tier[];
  nonMemberTiers: Tier[];
  memberFeeLabel?: string;
  memberFeePrice?: string;
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

function useDark() {
  const [dark, setDark] = React.useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );
  React.useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const EMPTY: PricingData = { memberTiers: [], nonMemberTiers: [], memberFeeLabel: '', memberFeePrice: '' };

export default function PricingTiersEditor({ name }: Props) {
  const field = useField(name);
  const dark = useDark();

  const [data, setData] = React.useState<PricingData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as PricingData;
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData(v as PricingData);
  }, [field.value]);

  const commit = (next: PricingData) => {
    setData(next);
    field.onChange(name, next);
  };

  const updateTier = (side: 'memberTiers' | 'nonMemberTiers', i: number, key: keyof Tier, val: string) => {
    const tiers = [...data[side]];
    tiers[i] = { ...tiers[i], [key]: val };
    commit({ ...data, [side]: tiers });
  };

  const addTier = (side: 'memberTiers' | 'nonMemberTiers') => {
    commit({ ...data, [side]: [...data[side], { label: '', price: '' }] });
  };

  const removeTier = (side: 'memberTiers' | 'nonMemberTiers', i: number) => {
    commit({ ...data, [side]: data[side].filter((_, idx) => idx !== i) });
  };

  const s = makeStyles(dark);

  const renderSection = (
    title: string,
    side: 'memberTiers' | 'nonMemberTiers',
    accent: boolean
  ) => (
    <div style={s.section}>
      <div style={{ ...s.sectionHeader, ...(accent ? s.sectionHeaderAccent : {}) }}>
        <span style={{ ...s.sectionTitle, ...(accent ? s.sectionTitleAccent : {}) }}>{title}</span>
        <button type="button" onClick={() => addTier(side)} style={s.addTierBtn}>+ Adaugă rând</button>
      </div>

      {data[side].length === 0 && (
        <div style={s.emptyState}>Niciun rând adăugat</div>
      )}

      {data[side].map((tier, i) => (
        <div key={i} style={{ ...s.tierCard, ...(i % 2 === 1 ? s.tierCardAlt : {}) }}>
          {/* Row 1: index + label + price + delete */}
          <div style={s.row}>
            <span style={s.rowNum}>{i + 1}</span>
            <input
              type="text"
              value={tier.label}
              placeholder="Etichetă…"
              onChange={e => updateTier(side, i, 'label', e.target.value)}
              style={{ ...s.inputRequired, flex: 1 }}
            />
            <input
              type="text"
              value={tier.price}
              placeholder="Preț…"
              onChange={e => updateTier(side, i, 'price', e.target.value)}
              style={{ ...s.inputRequired, width: 110, flexShrink: 0 }}
            />
            <button type="button" onClick={() => removeTier(side, i)} style={s.deleteBtn} title="Șterge">
              <Trash style={{ width: 13, height: 13 }} />
            </button>
          </div>

          {/* Row 2: tooltip full width */}
          <div style={s.indentedRow}>
            <div style={s.indent} />
            <div style={s.optionalField}>
              <span style={s.optionalLabel}>Tooltip <span style={s.optionalTag}>opțional</span></span>
              <textarea
                value={tier.tooltip ?? ''}
                rows={2}
                onChange={e => updateTier(side, i, 'tooltip', e.target.value)}
                style={tier.tooltip ? { ...s.textarea, ...s.textareaFilled } : { ...s.textarea, ...s.textareaEmpty }}
              />
            </div>
            <div style={{ width: 24, flexShrink: 0 }} />
          </div>

          {/* Row 3: note full width */}
          <div style={s.indentedRow}>
            <div style={s.indent} />
            <div style={s.optionalField}>
              <span style={s.optionalLabel}>Notă sub etichetă <span style={s.optionalTag}>opțional · text mic afișat sub numele prețului</span></span>
              <textarea
                value={tier.note ?? ''}
                rows={2}
                onChange={e => updateTier(side, i, 'note', e.target.value)}
                style={tier.note ? { ...s.textarea, ...s.textareaFilled } : { ...s.textarea, ...s.textareaEmpty }}
              />
            </div>
            <div style={{ width: 24, flexShrink: 0 }} />
          </div>
        </div>
      ))}

      {/* Member fee */}
      {side === 'memberTiers' && (
        <div style={s.feeCard}>
          <span style={s.feeLabel}>Taxă membru</span>
          <input
            type="text"
            value={data.memberFeeLabel ?? ''}
            placeholder="Etichetă taxă…"
            onChange={e => commit({ ...data, memberFeeLabel: e.target.value })}
            style={{ ...s.inputRequired, flex: 1 }}
          />
          <input
            type="text"
            value={data.memberFeePrice ?? ''}
            placeholder="Preț…"
            onChange={e => commit({ ...data, memberFeePrice: e.target.value })}
            style={{ ...s.inputRequired, width: 110, flexShrink: 0 }}
          />
          <div style={{ width: 24, flexShrink: 0 }} />
        </div>
      )}
    </div>
  );

  return (
    <div style={s.groupWrapper}>
      {/* Group header */}
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Prețuri cursuri grup</span>
        <span style={s.groupDesc}>
          Rândurile de mai jos apar în secțiunea de tarife de pe site. Fiecare rând are o etichetă și un preț obligatorii; tooltip-ul și nota sunt opționale.
        </span>
      </div>

      <div style={s.groupBody}>
        {renderSection('Pentru Membri', 'memberTiers', true)}
        {renderSection('Pentru Non-membri', 'nonMemberTiers', false)}
      </div>
    </div>
  );
}

function makeStyles(dark: boolean): Record<string, React.CSSProperties> {
  const border = dark ? '#333340' : '#e0e0e8';
  const bg = dark ? '#1e1e2e' : '#fff';
  const subtle = dark ? '#666' : '#999';

  const outerBorder = dark ? '#2a2a3e' : '#d0d0e0';

  // Required fields — always clearly filled
  const inputRequiredBorder = dark ? '#4a4a6a' : '#c0c0d0';
  const inputRequiredBg = dark ? '#252540' : '#fff';
  const inputRequiredColor = dark ? '#e0e0f0' : '#111';

  // Optional fields — empty state: visually subdued
  const textareaEmptyBorder = dark ? '#2e2e3e' : '#e8e8f0';
  const textareaEmptyBg = dark ? '#181828' : '#f7f7fb';
  const textareaEmptyColor = dark ? '#444' : '#aaa';

  // Optional fields — filled state: clearly distinct
  const textareaFilledBorder = dark ? '#5a5a9a' : '#7c7ccc';
  const textareaFilledBg = dark ? '#1e1e38' : '#f0f0ff';
  const textareaFilledColor = dark ? '#c8c8ff' : '#2a2a6a';

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
      gap: 3,
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
    groupBody: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 10,
      padding: 10,
    },
    section: {
      border: `1px solid ${border}`,
      borderRadius: 8,
      overflow: 'hidden',
      background: bg,
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      background: dark ? '#252535' : '#f5f5fa',
      borderBottom: `1px solid ${border}`,
    },
    sectionHeaderAccent: {
      background: dark ? '#1a1a30' : '#eef2ff',
      borderBottom: `1px solid ${dark ? '#2a2a50' : '#c7d2fe'}`,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      color: dark ? '#888' : '#666',
    },
    sectionTitleAccent: {
      color: dark ? '#8888bb' : '#4f5691',
    },
    addTierBtn: {
      padding: '3px 8px',
      border: `1px dashed ${dark ? '#555' : '#bbb'}`,
      borderRadius: 4,
      background: 'transparent',
      color: dark ? '#888' : '#666',
      cursor: 'pointer',
      fontSize: 11,
    },
    emptyState: {
      padding: '14px',
      textAlign: 'center' as const,
      fontSize: 12,
      color: subtle,
      fontStyle: 'italic',
    },
    tierCard: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 5,
      padding: '8px 10px',
      borderBottom: `1px solid ${border}`,
    },
    tierCardAlt: {
      background: dark ? '#191927' : '#fafafa',
    },
    row: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
    },
    indentedRow: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
    },
    indent: {
      width: 24,
      flexShrink: 0,
    },
    optionalField: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 2,
      minWidth: 0,
    },
    rowNum: {
      width: 18,
      height: 18,
      marginTop: 5,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 3,
      background: dark ? '#2a2a3a' : '#f0f0f5',
      color: subtle,
      fontSize: 10,
      fontWeight: 600,
    },
    inputRequired: {
      padding: '5px 8px',
      border: `1px solid ${inputRequiredBorder}`,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
      background: inputRequiredBg,
      color: inputRequiredColor,
      outline: 'none',
      boxSizing: 'border-box' as const,
      minWidth: 0,
      height: 28,
    },
    optionalLabel: {
      fontSize: 10,
      color: subtle,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    optionalTag: {
      fontSize: 9,
      fontStyle: 'italic',
      color: dark ? '#444' : '#bbb',
    },
    textarea: {
      width: '100%',
      padding: '5px 7px',
      borderRadius: 4,
      fontSize: 11,
      lineHeight: 1.5,
      resize: 'vertical' as const,
      outline: 'none',
      fontFamily: 'inherit',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.15s, background 0.15s',
    },
    textareaEmpty: {
      border: `1px dashed ${textareaEmptyBorder}`,
      background: textareaEmptyBg,
      color: textareaEmptyColor,
    },
    textareaFilled: {
      border: `1px solid ${textareaFilledBorder}`,
      background: textareaFilledBg,
      color: textareaFilledColor,
      fontWeight: 500,
    },
    deleteBtn: {
      width: 24,
      height: 24,
      marginTop: 2,
      padding: 0,
      border: '1px solid #fca5a5',
      borderRadius: 4,
      background: 'transparent',
      color: '#ef4444',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    feeCard: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 10px',
      borderTop: `2px dashed ${dark ? '#333' : '#e5e7eb'}`,
      background: dark ? '#1a1a28' : '#f0f0f8',
    },
    feeLabel: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: subtle,
      whiteSpace: 'nowrap' as const,
      flexShrink: 0,
    },
  };
}
