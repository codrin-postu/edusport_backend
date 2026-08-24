import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  DatePicker,
  Field,
  MultiSelect,
  MultiSelectOption,
  TextInput,
  Textarea,
  Toggle,
  Typography,
} from '@strapi/design-system';
import { ExternalLink } from '@strapi/icons';
import PluginModalShell, { FormRow, FormSection } from './PluginModalShell';

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
  [/[ăâ]/g, 'a'], [/î/g, 'i'], [/[șş]/g, 's'], [/[țţ]/g, 't'],
];

function toSlug(name: string): string {
  let s = name.toLowerCase();
  for (const [re, ch] of DIACRITICS) s = s.replace(re, ch);
  return s.replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function toISODate(d: Date | undefined | null): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

async function fetchEntries(get: Function, uid: string): Promise<RefEntry[]> {
  try {
    const res = await get(
      `/content-manager/collection-types/${uid}?page=1&pageSize=200&sort=name:ASC`,
    );
    return (res?.data?.results ?? []).map((e: any) => ({
      documentId: e.documentId ?? '',
      name: e.name ?? '',
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuickCreateSportspersonModal({
  isOpen,
  onClose,
  initialName,
  onCreate,
}: Props) {
  const { get, post } = useFetchClient();

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [careerGoal, setCareerGoal] = React.useState('');
  const [activeSince, setActiveSince] = React.useState<Date | undefined>(undefined);
  const [showPublicPage, setShowPublicPage] = React.useState(false);
  const [disciplineIds, setDisciplineIds] = React.useState<string[]>([]);
  const [coachIds, setCoachIds] = React.useState<string[]>([]);
  const [choreographerIds, setChoreographerIds] = React.useState<string[]>([]);

  const [disciplines, setDisciplines] = React.useState<RefEntry[]>([]);
  const [teamMembers, setTeamMembers] = React.useState<RefEntry[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdDocumentId, setCreatedDocumentId] = React.useState<string | null>(null);

  const getRef = React.useRef(get);
  React.useEffect(() => { getRef.current = get; });
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
    setActiveSince(undefined);
    setShowPublicPage(false);
    setDisciplineIds([]);
    setCoachIds([]);
    setChoreographerIds([]);
    setError(null);
    setSaving(false);
    setCreatedDocumentId(null);
  }, [isOpen, initialName]);

  React.useEffect(() => {
    if (!slugTouched) setSlug(toSlug(name));
  }, [name, slugTouched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      name: name.trim(),
      slug: slug.trim(),
      showPublicPage,
    };
    if (description.trim()) body.description = description.trim();
    if (careerGoal.trim()) body.careerGoal = careerGoal.trim();
    if (activeSince) body.activeSince = toISODate(activeSince);
    if (disciplineIds.length)
      body.disciplines = { connect: disciplineIds.map((id) => ({ documentId: id })) };
    if (coachIds.length)
      body.coaches = { connect: coachIds.map((id) => ({ documentId: id })) };
    if (choreographerIds.length)
      body.choreographers = { connect: choreographerIds.map((id) => ({ documentId: id })) };

    try {
      const createRes = await post(
        '/content-manager/collection-types/api::sportsperson.sportsperson',
        body,
      );
      const entry = (createRes as any)?.data;
      const documentId: string = entry?.documentId ?? entry?.data?.documentId;
      if (!documentId) throw new Error('Nu s-a primit documentId de la server.');

      await post(
        `/content-manager/collection-types/api::sportsperson.sportsperson/${documentId}/actions/publish`,
        {},
      );

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
      <Typography variant="pi" textColor="success600" style={{ flex: 1 }}>
        ✓ Sportivul a fost creat și publicat.
      </Typography>
      <Button
        variant="secondary"
        startIcon={<ExternalLink />}
        onClick={() =>
          window.open(
            `/admin/content-manager/collection-types/api::sportsperson.sportsperson/${createdDocumentId}`,
            '_blank',
          )
        }
      >
        Deschide profilul complet
      </Button>
      <Button onClick={onClose}>Închide</Button>
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
      <Button variant="tertiary" disabled={saving} onClick={onClose}>
        Anulează
      </Button>
      <Button
        type="submit"
        form="quick-create-sportsperson"
        loading={saving}
        disabled={!name.trim() || !slug.trim()}
      >
        Adaugă sportiv
      </Button>
    </div>
  );

  return (
    <PluginModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Adaugă sportiv nou"
      subtitle="Fotografia, galeria și muzica pot fi adăugate din profilul complet după creare."
      footer={footer}
      maxWidth={860}
    >
      <form
        id="quick-create-sportsperson"
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--strapi-danger100, #fcecea)',
            borderRadius: 4,
            borderLeft: '3px solid var(--strapi-danger600, #d02b20)',
          }}>
            <Typography textColor="danger600">{error}</Typography>
          </div>
        )}

        {/* ── Identity ── */}
        <FormSection label="Identitate">
          <FormRow columns={2}>
            <Field.Root name="sp-name" required>
              <Field.Label>Nume complet *</Field.Label>
              <TextInput
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="ex: Maria Popescu"
                required
                disabled={disabled}
              />
            </Field.Root>

            <Field.Root name="sp-slug" required>
              <Field.Label>Slug (URL) *</Field.Label>
              <TextInput
                value={slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="ex: maria-popescu"
                required
                disabled={disabled}
              />
              <Field.Hint>Auto-generat din nume · folosit în URL-ul profilului</Field.Hint>
            </Field.Root>
          </FormRow>
        </FormSection>

        {/* ── Profile ── */}
        <FormSection label="Profil">
          <Field.Root name="sp-description">
            <Field.Label>Descriere</Field.Label>
            <Textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Scurt bio al sportivului…"
              style={{ minHeight: 72, width: '100%' }}
              disabled={disabled}
            />
          </Field.Root>

          <Field.Root name="sp-career-goal">
            <Field.Label>Obiectiv carieră</Field.Label>
            <Textarea
              value={careerGoal}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCareerGoal(e.target.value)}
              placeholder="Ce vrea să atingă sportivul…"
              style={{ minHeight: 56, width: '100%' }}
              maxLength={300}
              disabled={disabled}
            />
          </Field.Root>

          <FormRow columns={2}>
            <Field.Root name="sp-active-since">
              <Field.Label>Activ din</Field.Label>
              <DatePicker
                value={activeSince}
                onChange={(date: Date | undefined) => setActiveSince(date ?? undefined)}
                clearLabel="Șterge"
                onClear={() => setActiveSince(undefined)}
                disabled={disabled}
              />
            </Field.Root>

            <Field.Root name="sp-public">
              <Field.Label>Pagină publică</Field.Label>
              <Box paddingTop={1}>
                <Toggle
                  checked={showPublicPage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setShowPublicPage(e.target.checked)
                  }
                  onLabel="Da"
                  offLabel="Nu"
                  disabled={disabled}
                />
              </Box>
              <Field.Hint>Afișează profilul pe site-ul public</Field.Hint>
            </Field.Root>
          </FormRow>
        </FormSection>

        {/* ── Relations ── */}
        {(disciplines.length > 0 || teamMembers.length > 0) && (
          <FormSection label="Relații">
            {disciplines.length > 0 && (
              <Field.Root name="sp-disciplines">
                <Field.Label>Discipline</Field.Label>
                <MultiSelect
                  value={disciplineIds}
                  onChange={(vals: string[]) => setDisciplineIds(vals)}
                  placeholder="Alege discipline…"
                  withTags
                  disabled={disabled}
                >
                  {disciplines.map((d) => (
                    <MultiSelectOption key={d.documentId} value={d.documentId}>
                      {d.name}
                    </MultiSelectOption>
                  ))}
                </MultiSelect>
              </Field.Root>
            )}

            {teamMembers.length > 0 && (
              <FormRow columns={2}>
                <Field.Root name="sp-coaches">
                  <Field.Label>Antrenori</Field.Label>
                  <MultiSelect
                    value={coachIds}
                    onChange={(vals: string[]) => setCoachIds(vals)}
                    placeholder="Alege antrenori…"
                    withTags
                    disabled={disabled}
                  >
                    {teamMembers.map((m) => (
                      <MultiSelectOption key={m.documentId} value={m.documentId}>
                        {m.name}
                      </MultiSelectOption>
                    ))}
                  </MultiSelect>
                </Field.Root>

                <Field.Root name="sp-choreographers">
                  <Field.Label>Coregrafi</Field.Label>
                  <MultiSelect
                    value={choreographerIds}
                    onChange={(vals: string[]) => setChoreographerIds(vals)}
                    placeholder="Alege coregrafi…"
                    withTags
                    disabled={disabled}
                  >
                    {teamMembers.map((m) => (
                      <MultiSelectOption key={m.documentId} value={m.documentId}>
                        {m.name}
                      </MultiSelectOption>
                    ))}
                  </MultiSelect>
                </Field.Root>
              </FormRow>
            )}
          </FormSection>
        )}

        {/* Info note */}
        <div style={{
          padding: '10px 14px',
          background: 'var(--strapi-neutral100, #f6f6f9)',
          borderRadius: 4,
          borderLeft: '3px solid var(--strapi-neutral300, #c0c0cf)',
        }}>
          <Typography variant="pi" textColor="neutral500">
            Fotografie, galerie, muzică sezon și hobby-uri se completează din pagina profilului după creare.
          </Typography>
        </div>
      </form>
    </PluginModalShell>
  );
}
