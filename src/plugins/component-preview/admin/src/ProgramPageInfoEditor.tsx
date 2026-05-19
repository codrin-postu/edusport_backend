import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Flex, LinkButton, TextInput, Typography } from '@strapi/design-system';
import { ArrowRight } from '@strapi/icons';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface ProgramPageInfoData {
  scheduleSubtitle: string;
}

const EMPTY: ProgramPageInfoData = {
  scheduleSubtitle: '',
};

const SITE_SETTINGS_HREF =
  '/admin/content-manager/single-types/api::site-settings.site-settings';

export default function ProgramPageInfoEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<ProgramPageInfoData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, scheduleSubtitle: (v as ProgramPageInfoData).scheduleSubtitle ?? '' };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, scheduleSubtitle: (v as ProgramPageInfoData).scheduleSubtitle ?? '' });
  }, [field.value]);

  const update = (key: keyof ProgramPageInfoData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Pagina Program - Informații"
        description="Subtitlul orarului afișat pe /cursuri/program. Etichetele și datele de sezon sunt setate global în Setări Site."
      >
        <Box padding={4}>
          <Flex direction="column" gap={4} alignItems="stretch">
            <EditorField
              name="scheduleSubtitle"
              label="Subtitlu orar"
              hint="Textul de sub titlul secțiunii de orar"
            >
              <TextInput
                id="scheduleSubtitle"
                name="scheduleSubtitle"
                value={data.scheduleSubtitle}
                placeholder="ex: Cursuri în fiecare weekend"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  update('scheduleSubtitle', e.target.value)
                }
              />
            </EditorField>

            <Box
              borderColor="neutral200"
              borderStyle="solid"
              borderWidth="1px"
              borderRadius="4px"
              padding={3}
              background="neutral100"
            >
              <Flex direction="column" gap={2} alignItems="flex-start">
                <Typography variant="pi" fontWeight="bold" textColor="neutral700">
                  Etichetă și date sezon
                </Typography>
                <Typography variant="pi" textColor="neutral600">
                  Setate o singură dată în Setări Site → Înscrieri & Sezon. Apar automat pe pagina Program și în calendar.
                </Typography>
                <LinkButton
                  href={SITE_SETTINGS_HREF}
                  variant="tertiary"
                  size="S"
                  endIcon={<ArrowRight />}
                >
                  Editează sezonul în Setări Site
                </LinkButton>
              </Flex>
            </Box>
          </Flex>
        </Box>
      </EditorCard>
    </Box>
  );
}
