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
  DateRangeInput,
  Switch,
  Field,
  Input,
  HelpTip,
  normalizeObject,
} from '../ui';
import { useSingleType, usePageForm } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { UID } from './routes';

/**
 * Setări site (/plugins/edusport-setari): the site-settings single type.
 *
 * Replaces the content-manager view and its two custom fields,
 * component-preview SiteSettingsRegistrationEditor (`registration`) and
 * SiteSettingsContactEditor (`contact`). Both are JSON attributes; the shapes
 * stay exactly as those editors wrote them, so the website reads them
 * unchanged:
 *   registration: { open, currentSeason, seasonStartDate, seasonEndDate }
 *   contact:      { phone, email, facebookUrl1, instagramUrl,
 *                   whatsappChannelUrl, addressDisplay, addressMapsUrl }
 * Keys the editors did not know are kept (the objects are merged, not
 * rebuilt). These are the only two attributes on the schema.
 */

interface Registration {
  open: boolean;
  currentSeason: string;
  seasonStartDate: string;
  seasonEndDate: string;
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
}

const EMPTY_REGISTRATION: Registration = {
  open: false,
  currentSeason: '',
  seasonStartDate: '',
  seasonEndDate: '',
};

const EMPTY_CONTACT: Contact = {
  phone: '',
  email: '',
  facebookUrl1: '',
  instagramUrl: '',
  whatsappChannelUrl: '',
  addressDisplay: '',
  addressMapsUrl: '',
};

const SetariSitePage: React.FC = () => {
  const page = useSingleType<SiteSettings>(UID.siteSettings);
  const form = usePageForm<SiteSettings>(page.data, page.saveState);

  const registration = normalizeObject<Registration>(form.value.registration, EMPTY_REGISTRATION);
  const contact = normalizeObject<Contact>(form.value.contact, EMPTY_CONTACT);

  const setRegistration = (patch: Partial<Registration>) =>
    form.set('registration', { ...registration, ...patch });

  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Setări site" subtitle="Înscrieri, sezon curent și date de contact, folosite pe tot site-ul." />

        {page.loading ? (
          <Loading />
        ) : page.error ? (
          <div className="ui-body">
            <Notice tone="danger">Nu am putut încărca setările site-ului.</Notice>
          </div>
        ) : (
          <div className="ui-body">
            <ObjectFieldCard<Registration>
              title="Înscrieri & sezon curent"
              description="Starea înscrierilor și sezonul curent. Setate o singură dată; folosite peste tot pe site."
              value={registration}
              onFieldChange={(key, v) => setRegistration({ [key]: v } as Partial<Registration>)}
              fields={[
                {
                  key: 'currentSeason',
                  label: 'Etichetă sezon',
                  hint: 'Eticheta scurtă a sezonului - apare în mai multe locuri pe site (homepage, pagina Program, calendar).',
                  placeholder: 'ex: 2025–2026',
                },
              ]}
            >
              <Field label="Înscrieri deschise" hint="Când este activ, pe site se afișează secțiunea de înscrieri. Când este inactiv, apare mesajul că înscrierile sunt închise.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ui-space-3)' }}>
                  <Switch
                    checked={registration.open}
                    onChange={(next) => setRegistration({ open: next })}
                    aria-label="Înscrieri deschise"
                  />
                  <span className="ui-hint">{registration.open ? 'Vizibile pe site' : 'Închise'}</span>
                  <HelpTip label="Comută starea de înscrieri afișată public pe site." />
                </div>
              </Field>

              <div style={{ marginTop: 'var(--ui-space-4)' }}>
                <DateRangeInput
                  value={{ start: registration.seasonStartDate || null, end: registration.seasonEndDate || null }}
                  onChange={(next) =>
                    setRegistration({
                      seasonStartDate: next.start ?? '',
                      seasonEndDate: next.end ?? '',
                    })
                  }
                  startLabel="Început sezon"
                  endLabel="Sfârșit sezon"
                  hint="Folosite în pagina Program și în calendar."
                />
              </div>
            </ObjectFieldCard>

            <ObjectFieldCard<Contact>
              title="Date de contact & rețele sociale"
              description="Informații afișate în footer-ul site-ului și pe paginile de contact. Modificările se reflectă pe tot site-ul."
              value={contact}
              onFieldChange={(key, v) => form.set('contact', { ...contact, [key]: v })}
              fields={[
                { key: 'phone', label: 'Număr telefon', hint: 'Cu sau fără spații - link-ul tel: se generează automat', placeholder: 'ex: 0723 623 712' },
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
              ]}
            />
          </div>
        )}

        {!page.loading && !page.error && (
          <SaveBar {...page.saveState.bar} onSave={() => void page.save(form.value)} onDiscard={form.reset} />
        )}
      </Window>

      <UnsavedGuard when={form.dirty} />
    </AdminPage>
  );
};

export default SetariSitePage;
