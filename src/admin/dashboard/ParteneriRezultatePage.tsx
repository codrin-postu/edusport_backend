import * as React from 'react';
import FormResultsPage, { type FormResultsConfig } from './FormResultsPage';

/**
 * EduSport admin — "Parteneri" results page.
 *
 * Thin configuration over the shared FormResultsPage inbox, backed by the
 * dedicated admin endpoint /api/forms/parteneri-rezultate (partner-submission).
 */

const CONFIG: FormResultsConfig = {
  title: 'Parteneri',
  subtitle: 'Propunerile de parteneriat trimise din pagina publică de parteneri.',
  apiBase: '/api/forms/parteneri-rezultate',
  statuses: [
    { value: 'Nou', label: 'Noi', color: '#2138b8' },
    { value: 'In discutii', label: 'În discuții', color: '#00838f' },
    { value: 'Confirmat', label: 'Confirmate', color: '#1f7a4d' },
    { value: 'Respins', label: 'Respinse', color: '#be3330' },
  ],
  fields: [
    { key: 'companyName', label: 'Companie' },
    { key: 'contactName', label: 'Persoană de contact' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefon' },
    { key: 'collaborationType', label: 'Tip colaborare' },
    { key: 'message', label: 'Mesaj', kind: 'longtext' },
    { key: 'submittedAt', label: 'Trimis la', kind: 'date' },
  ],
  listTitleKey: 'companyName',
  listSnippetKey: 'message',
  emailKey: 'email',
  phoneKey: 'phone',
  searchPlaceholder: 'Caută după companie, contact sau email',
};

export default function ParteneriRezultatePage() {
  return <FormResultsPage config={CONFIG} />;
}
