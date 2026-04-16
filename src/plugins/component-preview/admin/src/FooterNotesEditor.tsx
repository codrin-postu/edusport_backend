import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Trash } from '@strapi/icons';

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

const META_BY_CUSTOM_FIELD: Record<string, { title: string; desc: string; addLabel: string }> = {
  'plugin::component-preview.subscription-bullets': {
    title: 'Puncte abonament',
    desc: 'Lista de informații despre abonamente afișată pe cardul promo (durata ședinței, valabilitate, politica de recuperare etc.).',
    addLabel: '+ Adaugă punct',
  },
  'plugin::component-preview.info-tips': {
    title: 'Sfaturi & reguli',
    desc: 'Lista de informații practice afișată la finalul paginii (Ce trebuie să știi).',
    addLabel: '+ Adaugă sfat',
  },
  'plugin::component-preview.footer-notes': {
    title: 'Notițe subsol',
    desc: 'Texte afișate în subsolul secțiunii de prețuri (Taxe & Prețuri). Folosite pentru clarificări despre taxa de membru, politica de prețuri etc.',
    addLabel: '+ Adaugă notă',
  },
  'plugin::component-preview.historic-stats': {
    title: 'Statistici club',
    desc: 'Valorile afișate în grilă (ex: "10+|Competiții pe an"). Format: valoare|etichetă, câte una pe rând.',
    addLabel: '+ Adaugă statistică',
  },
  'plugin::component-preview.historic-events-organized': {
    title: 'Evenimente organizate de ACS EduSport',
    desc: 'Lista evenimentelor organizate de club, afișată pe pagina Istoric. Câte un eveniment pe rând.',
    addLabel: '+ Adaugă eveniment',
  },
  'plugin::component-preview.historic-events-participated': {
    title: 'Participări ale sportivilor EduSport',
    desc: 'Lista participărilor sportivilor la evenimente externe, afișată pe pagina Istoric. Câte un element pe rând.',
    addLabel: '+ Adaugă participare',
  },
  'plugin::component-preview.realizari-achievements': {
    title: 'Realizări notabile',
    desc: 'Lista realizărilor importante ale clubului, afișată în secțiunea Palmares de pe pagina Realizări.',
    addLabel: '+ Adaugă realizare',
  },
};

export default function FooterNotesEditor({ name, attribute }: Props) {
  const customField = (attribute?.customField as string) ?? '';
  const meta = META_BY_CUSTOM_FIELD[customField] ?? META_BY_CUSTOM_FIELD['plugin::component-preview.footer-notes'];
  const field = useField(name);
  const dark = useDark();

  const [notes, setNotes] = React.useState<string[]>(() =>
    Array.isArray(field.value) ? field.value : []
  );

  React.useEffect(() => {
    if (Array.isArray(field.value)) setNotes(field.value);
  }, [field.value]);

  const commit = (next: string[]) => {
    setNotes(next);
    field.onChange(name, next);
  };

  const update = (i: number, val: string) => {
    const next = [...notes];
    next[i] = val;
    commit(next);
  };

  const add = () => commit([...notes, '']);
  const remove = (i: number) => commit(notes.filter((_, idx) => idx !== i));

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper}>
      {/* Group header */}
      <div style={s.groupHeader}>
        <div style={s.groupHeaderTop}>
          <span style={s.groupTitle}>{meta.title}</span>
          <button type="button" onClick={add} style={s.addBtn}>{meta.addLabel}</button>
        </div>
        <span style={s.groupDesc}>{meta.desc}</span>
      </div>

      <div style={s.notesList}>
        {notes.length === 0 && (
          <div style={s.emptyState}>Nicio notă adăugată</div>
        )}
        {notes.map((text, i) => (
          <div key={i} style={s.noteRow}>
            <span style={s.noteNum}>{i + 1}</span>
            <textarea
              value={text}
              rows={3}
              placeholder="Textul notei…"
              onChange={e => update(i, e.target.value)}
              style={text ? { ...s.textarea, ...s.textareaFilled } : { ...s.textarea, ...s.textareaEmpty }}
            />
            <button type="button" onClick={() => remove(i)} style={s.deleteBtn} title="Șterge">
              <Trash style={{ width: 13, height: 13 }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function makeStyles(dark: boolean): Record<string, React.CSSProperties> {
  const border = dark ? '#333340' : '#e0e0e8';
  const bg = dark ? '#1e1e2e' : '#fff';
  const subtle = dark ? '#666' : '#999';
  const outerBorder = dark ? '#2a2a3e' : '#d0d0e0';

  const emptyBorder = dark ? '#2e2e3e' : '#e8e8f0';
  const emptyBg = dark ? '#181828' : '#f7f7fb';
  const emptyColor = dark ? '#444' : '#aaa';

  const filledBorder = dark ? '#5a5a9a' : '#7c7ccc';
  const filledBg = dark ? '#1e1e38' : '#f0f0ff';
  const filledColor = dark ? '#c8c8ff' : '#2a2a6a';

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
    groupHeaderTop: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    addBtn: {
      padding: '3px 8px',
      border: `1px dashed ${dark ? '#555' : '#bbb'}`,
      borderRadius: 4,
      background: 'transparent',
      color: dark ? '#888' : '#666',
      cursor: 'pointer',
      fontSize: 11,
    },
    notesList: {
      display: 'flex',
      flexDirection: 'column' as const,
      background: bg,
    },
    emptyState: {
      padding: '14px',
      textAlign: 'center' as const,
      fontSize: 12,
      color: subtle,
      fontStyle: 'italic',
    },
    noteRow: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '8px 10px',
      borderBottom: `1px solid ${border}`,
    },
    noteNum: {
      width: 18,
      height: 18,
      marginTop: 6,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 3,
      background: dark ? '#2a2a3a' : '#e8e8f0',
      color: subtle,
      fontSize: 10,
      fontWeight: 600,
    },
    textarea: {
      flex: 1,
      padding: '7px 9px',
      borderRadius: 4,
      fontSize: 12,
      lineHeight: 1.7,
      resize: 'vertical' as const,
      outline: 'none',
      fontFamily: 'inherit',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.15s, background 0.15s',
    },
    textareaEmpty: {
      border: `1px dashed ${emptyBorder}`,
      background: emptyBg,
      color: emptyColor,
    },
    textareaFilled: {
      border: `1px solid ${filledBorder}`,
      background: filledBg,
      color: filledColor,
      fontWeight: 500,
    },
    deleteBtn: {
      width: 24,
      height: 24,
      marginTop: 4,
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
  };
}
