import * as React from 'react';
import { StringListEditor } from './components/StringListEditor';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

const META_BY_CUSTOM_FIELD: Record<
  string,
  { title: string; desc: string; addLabel: string; placeholder?: string; rows?: number }
> = {
  'plugin::component-preview.subscription-bullets': {
    title: 'Informații abonament',
    desc: 'Lista de informații despre abonamente afișată pe cardul promo (durata ședinței, valabilitate, politica de recuperare etc.).',
    addLabel: 'Adaugă',
  },
  'plugin::component-preview.info-tips': {
    title: 'Sfaturi & reguli',
    desc: 'Lista de informații practice afișată la finalul paginii (Ce trebuie să știi).',
    addLabel: 'Adaugă sfat',
  },
  'plugin::component-preview.footer-notes': {
    title: 'Notițe subsol',
    desc: 'Texte afișate în subsolul secțiunii de prețuri (Taxe & Prețuri). Folosite pentru clarificări despre taxa de membru, politica de prețuri etc.',
    addLabel: 'Adaugă notă',
    placeholder: 'Textul notei…',
  },
  'plugin::component-preview.historic-stats': {
    title: 'Statistici club',
    desc: 'Valorile afișate în grilă (ex: "10+|Competiții pe an"). Format: valoare|etichetă, câte una pe rând.',
    addLabel: 'Adaugă statistică',
    placeholder: 'ex: 10+|Competiții pe an',
    rows: 1,
  },
  'plugin::component-preview.historic-events-organized': {
    title: 'Evenimente organizate de ACS EduSport',
    desc: 'Lista evenimentelor organizate de club, afișată pe pagina Istoric. Câte un eveniment pe rând.',
    addLabel: 'Adaugă eveniment',
  },
  'plugin::component-preview.historic-events-participated': {
    title: 'Participări ale sportivilor EduSport',
    desc: 'Lista participărilor sportivilor la evenimente externe, afișată pe pagina Istoric. Câte un element pe rând.',
    addLabel: 'Adaugă participare',
  },
  'plugin::component-preview.realizari-achievements': {
    title: 'Realizări notabile',
    desc: 'Lista realizărilor importante ale clubului, afișată în secțiunea Palmares de pe pagina Realizări.',
    addLabel: 'Adaugă realizare',
  },
};

const DEFAULT_KEY = 'plugin::component-preview.footer-notes';

export default function FooterNotesEditor({ name, attribute }: Props) {
  const customField = (attribute?.customField as string) ?? '';
  const meta = META_BY_CUSTOM_FIELD[customField] ?? META_BY_CUSTOM_FIELD[DEFAULT_KEY];

  return (
    <StringListEditor
      name={name}
      title={meta.title}
      description={meta.desc}
      addLabel={meta.addLabel}
      itemPlaceholder={meta.placeholder}
      rows={meta.rows}
    />
  );
}
