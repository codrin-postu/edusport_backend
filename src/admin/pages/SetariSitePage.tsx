import * as React from 'react';
import {
  AdminPage,
  Window,
  PageHeader,
  Notice,
  Loading,
  SaveBar,
  UnsavedGuard,
  ObjectFieldCard,
  EditorCard,
  Switch,
  Field,
  HelpTip,
  NumberInput,
  normalizeObject,
  type ObjectFieldConfig,
} from '../ui';
import { useSingleType, usePageForm, type PageForm } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';
import { PERSONAL_DATA_COPY } from '../../club/personal-data/copy';
import { DEFAULT_RETENTION_YEARS, RETENTION_BOUNDS, retentionYearsOf, type PersonalDataSettings } from '../../club/personal-data/settings';

/**
 * Setări site (/plugins/edusport-setari): the site-settings single type.
 *
 * Replaces the content-manager view and its two custom fields,
 * component-preview SiteSettingsRegistrationEditor (`registration`) and
 * SiteSettingsContactEditor (`contact`). Both are JSON attributes; the shapes
 * stay exactly as those editors wrote them, so the website reads them
 * unchanged:
 *   registration: { open } (editable here), plus the retired season fields
 *                 currentSeason, seasonStartDate, seasonEndDate (spec 1.6: kept, no longer
 *                 edited; seasons live on the Sezoane page)
 *   contact:      { phone, email, facebookUrl1, instagramUrl,
 *                   whatsappChannelUrl, addressDisplay, addressMapsUrl }
 * Keys the editors did not know are kept (the objects are merged, not
 * rebuilt). Plus `personalData` (3C): `{ retentionYears, reviewHiddenUntilSeason }`,
 * the number edited here, the season written by the dashboard notice.
 */

/** Only `open` is edited; the stored season keys ride along untouched (normalizeObject keeps them). */
interface Registration {
  open: boolean;
}

interface Contact {
  phone: string;
  email: string;
  facebookUrl1: string;
  instagramUrl: string;
  whatsappChannelUrl: string;
  addressDisplay: string;
  addressMapsUrl: string;
}

interface SiteSettings {
  registration: Registration | null;
  contact: Contact | null;
  personalData: PersonalDataSettings | null;
}

const EMPTY_REGISTRATION: Registration = { open: false };

const EMPTY_CONTACT: Contact = {
  phone: '',
  email: '',
  facebookUrl1: '',
  instagramUrl: '',
  whatsappChannelUrl: '',
  addressDisplay: '',
  addressMapsUrl: '',
};

const EMPTY_PERSONAL_DATA: PersonalDataSettings = { retentionYears: DEFAULT_RETENTION_YEARS, reviewHiddenUntilSeason: null };

const CONTACT_FIELDS: ObjectFieldConfig<Contact>[] = [
  { key: 'phone', label: 'Număr telefon', hint: 'Cu sau fără spații, link-ul tel: se generează automat', placeholder: 'ex: 0723 623 712' },
  { key: 'email', label: 'Adresă email', type: 'text', placeholder: 'ex: scoala.de.patinaj@gmail.com' },
  { key: 'facebookUrl1', label: 'Facebook', placeholder: 'ex: https://facebook.com/edusport', span: 2 },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'ex: https://instagram.com/edusport', span: 2 },
  { key: 'whatsappChannelUrl', label: 'Canal WhatsApp', hint: 'Link către canalul de WhatsApp', placeholder: 'ex: https://whatsapp.com/channel/...', span: 2 },
  { key: 'addressDisplay', label: 'Adresă afișată', hint: 'Textul adresei care apare pe site', placeholder: 'ex: Patinoarul AFI Cotroceni, București', span: 2 },
  {
    key: 'addressMapsUrl',
    label: 'Link hartă (opțional)',
    hint: 'Lasă gol și adresa duce automat la o căutare Google Maps. Completează doar dacă vrei un loc anume: deschide locația în Google Maps, apasă Partajează, copiază linkul.',
    placeholder: 'ex: https://maps.app.goo.gl/...',
    span: 2,
  },
];

type FormProps = { form: PageForm<SiteSettings> };

const RegistrationCard: React.FC<FormProps> = ({ form }) => {
  const registration = normalizeObject<Registration>(form.value.registration, EMPTY_REGISTRATION);
  return (
    <EditorCard title="Înscrieri">
      <Field label="Înscrieri deschise" hint="Când este activ, pe site se afișează secțiunea de înscrieri. Când este inactiv, apare mesajul că înscrierile sunt închise.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ui-space-3)' }}>
          <Switch
            checked={registration.open}
            onChange={(next) => form.set('registration', { ...registration, open: next })}
            aria-label="Înscrieri deschise"
          />
          <span className="ui-hint">{registration.open ? 'Vizibile pe site' : 'Închise'}</span>
          <HelpTip label="Comută starea de înscrieri afișată public pe site." />
        </div>
      </Field>
    </EditorCard>
  );
};

const ContactCard: React.FC<FormProps> = ({ form }) => {
  const contact = normalizeObject<Contact>(form.value.contact, EMPTY_CONTACT);
  return (
    <ObjectFieldCard<Contact>
      title="Date de contact & rețele sociale"
      description="Informații afișate în footer-ul site-ului și pe paginile de contact. Modificările se reflectă pe tot site-ul."
      value={contact}
      onFieldChange={(key, v) => form.set('contact', { ...contact, [key]: v })}
      fields={CONTACT_FIELDS}
    />
  );
};

const PersonalDataCard: React.FC<FormProps> = ({ form }) => {
  const personalData = normalizeObject<PersonalDataSettings>(form.value.personalData, EMPTY_PERSONAL_DATA);
  return (
    <EditorCard title={PERSONAL_DATA_COPY.settingsCard}>
      <Field label={PERSONAL_DATA_COPY.settingsField}>
        <NumberInput
          value={personalData.retentionYears}
          min={RETENTION_BOUNDS.min}
          max={RETENTION_BOUNDS.max}
          allowEmpty={false}
          label={PERSONAL_DATA_COPY.settingsField}
          onChange={(next) => form.set('personalData', { ...personalData, retentionYears: retentionYearsOf(next) })}
        />
      </Field>
    </EditorCard>
  );
};

const SetariSitePage: React.FC = () => {
  const page = useSingleType<SiteSettings>(UID.siteSettings);
  const form = usePageForm<SiteSettings>(page.data, page.saveState);
  const ready = !page.loading && !page.error;
  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Setări site" subtitle="Înscrieri și date de contact, folosite pe tot site-ul." />
        {page.loading && <Loading />}
        {!page.loading && page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca setările site-ului.</Notice>
          </div>
        ) : null}
        {ready && (
          <div className="ui-body">
            <RegistrationCard form={form} />
            <ContactCard form={form} />
            <PersonalDataCard form={form} />
          </div>
        )}
        {ready && <SaveBar {...page.saveState.bar} onSave={() => void page.save(form.value)} onDiscard={form.reset} />}
      </Window>
      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
};

export default SetariSitePage;
