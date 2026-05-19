import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Divider, Grid, TextInput, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface HeroData {
  motto: string;
  ctaLabel: string;
  ctaUrl: string;
}

const EMPTY: HeroData = { motto: '', ctaLabel: '', ctaUrl: '' };

export default function HomepageHeroEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<HeroData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as HeroData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as HeroData) });
  }, [field.value]);

  const update = (key: keyof HeroData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  const onText =
    (key: keyof HeroData) => (e: React.ChangeEvent<HTMLInputElement>) => update(key, e.target.value);

  return (
    <Box width="100%">
      <EditorCard
        title="Secțiunea Hero"
        description="Prima secțiune vizibilă pe pagina principală. Conține motto-ul mare și butonul de acțiune principal."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField
                name="motto"
                label="Motto"
                hint="Textul mare afișat în centrul secțiunii hero, ex: Educație prin sport"
              >
                <TextInput id="motto" name="motto" value={data.motto} placeholder="ex: Educație prin sport" onChange={onText('motto')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <Box paddingBottom={2}>
                <Divider />
              </Box>
              <Typography variant="pi" fontWeight="semiBold" textColor="neutral600">
                Buton de acțiune
              </Typography>
            </Grid.Item>

            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="ctaLabel" label="Text buton" hint="Textul afișat pe butonul principal">
                <TextInput id="ctaLabel" name="ctaLabel" value={data.ctaLabel} placeholder="ex: Descoperă Cursurile" onChange={onText('ctaLabel')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="ctaUrl" label="Link buton" hint="Destinația butonului, ex: /cursuri">
                <TextInput id="ctaUrl" name="ctaUrl" value={data.ctaUrl} placeholder="ex: /cursuri" onChange={onText('ctaUrl')} />
              </EditorField>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
