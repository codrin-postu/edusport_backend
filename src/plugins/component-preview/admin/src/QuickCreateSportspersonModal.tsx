import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
// Shared admin UI. Same vite bundle (src/admin/app.tsx imports this plugin by
// relative path), so importing across the boundary is safe and type-checked.
import {
  Modal,
  Section,
  Field,
  FieldRow,
  Input,
  Textarea,
  DateInput,
  Switch,
  TagsInput,
  Button,
  Notice,
} from '../../../../admin/ui';

/**
 * "Adaugă sportiv nou" dialog, opened from ParticipantsEditor when the typed
 * name matches no sportsperson. Creates the entry through the content-manager
 * and publishes it, then hands { documentId, name } back to the caller.
 *
 * Built on the shared admin UI (src/admin/ui): Modal, Field + inputs, Switch for
 * the public page flag, TagsInput (suggestions only) for the relations, and
 * DateInput, which keeps "Activ din" as the plain YYYY-MM-DD the user picked
 * (the old DS DatePicker sent toISOString() of local midnight, one day early
 * east of UTC).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatedSportsperson {
  documentId: string;
  name: string;
}

interface RefEntry {
  documentId: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  onCreate: (sp: CreatedSportsperson) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIACRITICS: [RegExp, string][] = [
  [/[ăâ]/g, 'a'],
  [/î/g, 'i'],
  [/[șş]/g, 's'],
  [/[țţ]/g, 't'],
];

function toSlug(name: string): string {
  let s = name.toLowerCase();
  for (const [re, ch] of DIACRITICS) s = s.replace(re, ch);
  return s.replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

async function fetchEntries(get: Function, uid: string): Promise<RefEntry[]> {
  try {
    const res = await get(`/content-manager/collection-types/${uid}?page=1&pageSize=200&sort=name:ASC`);
    return (res?.data?.results ?? []).map((e: any) => ({
      documentId: e.documentId ?? '',
      name: e.name ?? '',
    }));
  } catch {
    return [];
  }
}

/**
 * TagsInput works on labels; relations need documentIds. Names map back to the
 * first entry with that name (case-insensitive, like TagsInput's dedupe).
 */
function namesToIds(names: string[], pool: RefEntry[]): string[] {
  const byName = new Map<string, string>();
  for (const e of pool) {
    const k = e.name.trim().toLocaleLowerCase('ro');
    if (!byName.has(k)) byName.set(k, e.documentId);
  }
  return names.map((n) => byName.get(n.trim().toLocaleLowerCase('ro'))).filter((id): id is string => !!id);
}

const uniqueNames = (pool: RefEntry[]) => Array.from(new Set(pool.map((e) => e.name).filter(Boolean)));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuickCreateSportspersonModal({ isOpen, onClose, initialName, onCreate }: Props) {
  const { get, post } = useFetchClient();

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [careerGoal, setCareerGoal] = React.useState('');
  const [activeSince, setActiveSince] = React.useState<string | null>(null);
  const [showPublicPage, setShowPublicPage] = React.useState(false);
  const [disciplineNames, setDisciplineNames] = React.useState<string[]>([]);
  const [coachNames, setCoachNames] = React.useState<string[]>([]);
  const [choreographerNames, setChoreographerNames] = React.useState<string[]>([]);

  const [disciplines, setDisciplines] = React.useState<RefEntry[]>([]);
  const [teamMembers, setTeamMembers] = React.useState<RefEntry[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdDocumentId, setCreatedDocumentId] = React.useState<string | null>(null);

  const getRef = React.useRef(get);
  React.useEffect(() => {
    getRef.current = get;
  });
  React.useEffect(() => {
    fetchEntries(getRef.current, 'api::discipline.discipline').then(setDisciplines);
    fetchEntries(getRef.current, 'api::team-member.team-member').then(setTeamMembers);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    setName(initialName);
    setSlug(toSlug(initialName));
    setSlugTouched(false);
    setDescription('');
    setCareerGoal('');
    setActiveSince(null);
    setShowPublicPage(false);
    setDisciplineNames([]);
    setCoachNames([]);
    setChoreographerNames([]);
    setError(null);
    setSaving(false);
    setCreatedDocumentId(null);
  }, [isOpen, initialName]);

  React.useEffect(() => {
    if (!slugTouched) setSlug(toSlug(name));
  }, [name, slugTouched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The dialog is portalled, but React still bubbles the submit to the
    // content-manager form this editor sits in; keep it here.
    e.stopPropagation();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    setError(null);

    const disciplineIds = namesToIds(disciplineNames, disciplines);
    const coachIds = namesToIds(coachNames, teamMembers);
    const choreographerIds = namesToIds(choreographerNames, teamMembers);

    const body: Record<string, unknown> = {
      name: name.trim(),
      slug: slug.trim(),
      showPublicPage,
    };
    if (description.trim()) body.description = description.trim();
    if (careerGoal.trim()) body.careerGoal = careerGoal.trim();
    if (activeSince) body.activeSince = activeSince;
    if (disciplineIds.length) body.disciplines = { connect: disciplineIds.map((id) => ({ documentId: id })) };
    if (coachIds.length) body.coaches = { connect: coachIds.map((id) => ({ documentId: id })) };
    if (choreographerIds.length) body.choreographers = { connect: choreographerIds.map((id) => ({ documentId: id })) };

    try {
      const createRes = await post('/content-manager/collection-types/api::sportsperson.sportsperson', body);
      const entry = (createRes as any)?.data;
      const documentId: string = entry?.documentId ?? entry?.data?.documentId;
      if (!documentId) throw new Error('Nu s-a primit documentId de la server.');

      await post(`/content-manager/collection-types/api::sportsperson.sportsperson/${documentId}/actions/publish`, {});

      setCreatedDocumentId(documentId);
      onCreate({ documentId, name: name.trim() });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Eroare la creare.');
    } finally {
      setSaving(false);
    }
  };

  const disabled = !!createdDocumentId;

  const footer = createdDocumentId ? (
    <>
      <Button
        variant="secondary"
        onClick={() => window.open(`/admin/content-manager/collection-types/api::sportsperson.sportsperson/${createdDocumentId}`, '_blank')}
      >
        Deschide profilul complet
      </Button>
      <Button onClick={onClose}>Închide</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" disabled={saving} onClick={onClose}>
        Anulează
      </Button>
      <Button type="submit" form="quick-create-sportsperson" loading={saving} disabled={!name.trim() || !slug.trim()}>
        Adaugă sportiv
      </Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title="Adaugă sportiv nou" size="lg" footer={footer} dismissable={!saving}>
      <form id="quick-create-sportsperson" onSubmit={handleSubmit} className="ui-stack">
        <p className="ui-muted" style={{ margin: 0 }}>
          Fotografia, galeria și muzica pot fi adăugate din profilul complet după creare.
        </p>

        {error && <Notice tone="danger">{error}</Notice>}
        {createdDocumentId && <Notice tone="success">Sportivul a fost creat și publicat.</Notice>}

        <Section title="Identitate">
          <FieldRow>
            <Field label="Nume complet" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Maria Popescu" disabled={disabled} />
            </Field>
            <Field label="Slug (URL)" required hint="Auto-generat din nume · folosit în URL-ul profilului">
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="ex: maria-popescu"
                disabled={disabled}
              />
            </Field>
          </FieldRow>
        </Section>

        <Section title="Profil">
          <div className="ui-stack">
            <Field label="Descriere">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scurt bio al sportivului…"
                rows={3}
                disabled={disabled}
              />
            </Field>
            <Field label="Obiectiv carieră">
              <Textarea
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                placeholder="Ce vrea să atingă sportivul…"
                rows={2}
                maxLength={300}
                disabled={disabled}
              />
            </Field>
            <FieldRow>
              <Field label="Activ din">
                <DateInput value={activeSince} onChange={setActiveSince} disabled={disabled} />
              </Field>
              <div className="ui-field">
                <span className="ui-label">Pagină publică</span>
                <Switch
                  checked={showPublicPage}
                  onChange={setShowPublicPage}
                  label={showPublicPage ? 'Da' : 'Nu'}
                  description="Afișează profilul pe site-ul public"
                  disabled={disabled}
                />
              </div>
            </FieldRow>
          </div>
        </Section>

        {(disciplines.length > 0 || teamMembers.length > 0) && (
          <Section title="Relații">
            <div className="ui-stack">
              {disciplines.length > 0 && (
                <Field label="Discipline">
                  <TagsInput
                    value={disciplineNames}
                    onChange={setDisciplineNames}
                    suggestions={uniqueNames(disciplines)}
                    suggestionsOnly
                    placeholder="Alege discipline…"
                    disabled={disabled}
                  />
                </Field>
              )}
              {teamMembers.length > 0 && (
                <FieldRow>
                  <Field label="Antrenori">
                    <TagsInput
                      value={coachNames}
                      onChange={setCoachNames}
                      suggestions={uniqueNames(teamMembers)}
                      suggestionsOnly
                      placeholder="Alege antrenori…"
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Coregrafi">
                    <TagsInput
                      value={choreographerNames}
                      onChange={setChoreographerNames}
                      suggestions={uniqueNames(teamMembers)}
                      suggestionsOnly
                      placeholder="Alege coregrafi…"
                      disabled={disabled}
                    />
                  </Field>
                </FieldRow>
              )}
            </div>
          </Section>
        )}

        <Notice tone="info">Fotografie, galerie, muzică sezon și hobby-uri se completează din pagina profilului după creare.</Notice>
      </form>
    </Modal>
  );
}
