import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import {
  Box,
  Field,
  Flex,
  TextInput,
  Toggle,
  Typography,
} from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { HelpTip } from './components/HelpTip';
import { SafeDatePicker as DatePicker } from './components/SafeDatePicker';
import { formatRomanianDate } from './utils/seasonFormat';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface RegistrationData {
  open: boolean;
  currentSeason: string;
  seasonStartDate?: string;
  seasonEndDate?: string;
}

const EMPTY: RegistrationData = {
  open: false,
  currentSeason: '',
  seasonStartDate: '',
  seasonEndDate: '',
};

function isoFromDate(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function dateFromIso(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const match = iso.match(ISO_DATE_RE);
  if (!match) return undefined;
  // SafeDatePicker handles timezone safety; just construct a plain local Date.
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function LabelWithTip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Flex gap={2} alignItems="center">
      <Field.Label>{children}</Field.Label>
      <HelpTip label={tip} />
    </Flex>
  );
}

export default function SiteSettingsRegistrationEditor({ name }: Props) {
  const field = useField(name);

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

  return (
    <Box width="100%">
      <EditorCard
        title="Înscrieri & Sezon"
        description="Starea înscrierilor și sezonul curent. Setate o singură dată; folosite peste tot pe site."
      >
        <Box padding={4}>
          <Flex direction="column" gap={6} alignItems="stretch">
            <Box>
              <Field.Root id={`${name}-open`} name="open" width="100%">
                <LabelWithTip tip="Când este activ, pe site se afișează secțiunea de înscrieri. Când este inactiv, apare mesajul că înscrierile sunt închise.">
                  Înscrieri deschise
                </LabelWithTip>
                <Box marginTop={2}>
                  <Flex gap={3} alignItems="center" wrap="wrap">
                    <Toggle
                      id={`${name}-open`}
                      checked={data.open}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        commit({ ...data, open: e.target.checked })
                      }
                      onLabel="Deschise"
                      offLabel="Închise"
                    />
                    <Typography
                      variant="omega"
                      fontWeight="semiBold"
                      textColor={data.open ? 'success600' : 'neutral500'}
                    >
                      {data.open ? 'Vizibile pe site' : 'Închise'}
                    </Typography>
                  </Flex>
                </Box>
              </Field.Root>
            </Box>

            <Box>
              <Box paddingBottom={3}>
                <Typography variant="sigma" textColor="neutral700">
                  Sezon curent
                </Typography>
              </Box>

              <Flex direction="column" gap={4} alignItems="stretch">
                <Field.Root id="currentSeason" name="currentSeason" width="100%">
                  <LabelWithTip tip="Eticheta scurtă a sezonului - apare în mai multe locuri pe site (homepage, pagina Program, calendar).">
                    Etichetă sezon
                  </LabelWithTip>
                  <Box marginTop={1}>
                    <TextInput
                      id="currentSeason"
                      name="currentSeason"
                      value={data.currentSeason}
                      placeholder="ex: 2025–2026"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        commit({ ...data, currentSeason: e.target.value })
                      }
                    />
                  </Box>
                </Field.Root>

                <Flex gap={4} alignItems="flex-start" wrap="wrap">
                  <Box style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <Field.Root id="seasonStartDate" name="seasonStartDate" width="100%">
                      <LabelWithTip tip="Data primei zile a sezonului. Folosită în pagina Program și în calendar.">
                        Început sezon
                      </LabelWithTip>
                      <Box marginTop={1}>
                        <DatePicker
                          locale="ro-RO"
                          value={dateFromIso(data.seasonStartDate)}
                          onChange={(date) =>
                            commit({ ...data, seasonStartDate: isoFromDate(date) })
                          }
                          onClear={() =>
                            commit({ ...data, seasonStartDate: undefined })
                          }
                          clearLabel="Șterge data"
                        />
                      </Box>
                      {data.seasonStartDate && (
                        <Box paddingTop={1}>
                          <Typography variant="pi" textColor="neutral500">
                            {formatRomanianDate(data.seasonStartDate)}
                          </Typography>
                        </Box>
                      )}
                    </Field.Root>
                  </Box>

                  <Box style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <Field.Root id="seasonEndDate" name="seasonEndDate" width="100%">
                      <LabelWithTip tip="Data ultimei zile a sezonului. Folosită în pagina Program și în calendar.">
                        Sfârșit sezon
                      </LabelWithTip>
                      <Box marginTop={1}>
                        <DatePicker
                          locale="ro-RO"
                          value={dateFromIso(data.seasonEndDate)}
                          onChange={(date) =>
                            commit({ ...data, seasonEndDate: isoFromDate(date) })
                          }
                          onClear={() =>
                            commit({ ...data, seasonEndDate: undefined })
                          }
                          clearLabel="Șterge data"
                        />
                      </Box>
                      {data.seasonEndDate && (
                        <Box paddingTop={1}>
                          <Typography variant="pi" textColor="neutral500">
                            {formatRomanianDate(data.seasonEndDate)}
                          </Typography>
                        </Box>
                      )}
                    </Field.Root>
                  </Box>
                </Flex>
              </Flex>
            </Box>
          </Flex>
        </Box>
      </EditorCard>
    </Box>
  );
}
