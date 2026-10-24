import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Field, Flex, Toggle, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { HelpTip } from './components/HelpTip';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

/**
 * Only `open` is edited. The retired season keys (currentSeason, seasonStartDate, seasonEndDate)
 * stay in the stored object untouched (spec 1.6); seasons are edited on the Sezoane page.
 */
type RegistrationData = { open: boolean } & Record<string, unknown>;

const EMPTY: RegistrationData = { open: false };

function LabelWithTip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Flex gap={2} alignItems="center">
      <Field.Label>{children}</Field.Label>
      <HelpTip label={tip} />
    </Flex>
  );
}

const readValue = (v: unknown): RegistrationData =>
  v && typeof v === 'object' && !Array.isArray(v) ? { ...EMPTY, ...(v as RegistrationData) } : EMPTY;

export default function SiteSettingsRegistrationEditor({ name }: Props) {
  const field = useField(name);
  const [data, setData] = React.useState<RegistrationData>(() => readValue(field.value));

  React.useEffect(() => {
    if (field.value && typeof field.value === 'object') setData(readValue(field.value));
  }, [field.value]);

  const commit = (next: RegistrationData) => {
    setData(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard title="Înscrieri" description="Starea înscrierilor pe site.">
        <Box padding={4}>
          <Field.Root id={`${name}-open`} name="open" width="100%">
            <LabelWithTip tip="Când este activ, pe site se afișează secțiunea de înscrieri. Când este inactiv, apare mesajul că înscrierile sunt închise.">
              Înscrieri deschise
            </LabelWithTip>
            <Box marginTop={2}>
              <Flex gap={3} alignItems="center" wrap="wrap">
                <Toggle
                  id={`${name}-open`}
                  checked={data.open}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => commit({ ...data, open: e.target.checked })}
                  onLabel="Deschise"
                  offLabel="Închise"
                />
                <Typography variant="omega" fontWeight="semiBold" textColor={data.open ? 'success600' : 'neutral500'}>
                  {data.open ? 'Vizibile pe site' : 'Închise'}
                </Typography>
              </Flex>
            </Box>
          </Field.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
