import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Divider, Grid, Textarea, TextInput, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface RegistrationData {
  heading: string;
  body: string;
  bodySecondary: string;
  scheduleDays: string;
  scheduleTimes: string;
  locationName: string;
  ctaPrimaryLabel: string;
  ctaPrimaryUrl: string;
  ctaSecondaryLabel: string;
  ctaSecondaryUrl: string;
  pricesLinkLabel: string;
  pricesLinkUrl: string;
}

const EMPTY: RegistrationData = {
  heading: '',
  body: '',
  bodySecondary: '',
  scheduleDays: '',
  scheduleTimes: '',
  locationName: '',
  ctaPrimaryLabel: '',
  ctaPrimaryUrl: '',
  ctaSecondaryLabel: '',
  ctaSecondaryUrl: '',
  pricesLinkLabel: '',
  pricesLinkUrl: '',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box paddingTop={2}>
      <Box paddingBottom={2}>
        <Divider />
      </Box>
      <Typography variant="pi" fontWeight="semiBold" textColor="neutral600">
        {children}
      </Typography>
    </Box>
  );
}

export default function HomepageRegistrationEditor({ name }: Props) {
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

  const update = (key: keyof RegistrationData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  const onText =
    (key: keyof RegistrationData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      update(key, e.target.value);

  return (
    <Box width="100%">
      <EditorCard
        title="Secțiunea Înscrieri (Sezon Activ)"
        description="Afișată când înscrierile sunt deschise (controlat din Setări Site). Conține detalii despre sezon, orar, locație și butoane de acțiune."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="heading" label="Titlu secțiune" hint="Mesajul principal, ex: Sezonul a început!">
                <TextInput id="heading" name="heading" value={data.heading} placeholder="ex: Sezonul a început!" onChange={onText('heading')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Texte informative</SectionTitle>
            </Grid.Item>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="body" label="Text principal" hint="Textul principal al secțiunii. Separă paragrafele cu o linie goală.">
                <Textarea
                  id="body"
                  name="body"
                  value={data.body}
                  rows={4}
                  placeholder="ex: Suntem bucuroși să anunțăm că înscrierile pentru sezonul 2025–2026 sunt deschise..."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update('body', e.target.value)}
                />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="bodySecondary" label="Text secundar" hint="Text opțional afișat mai jos (ex: condiții suplimentare)">
                <Textarea
                  id="bodySecondary"
                  name="bodySecondary"
                  value={data.bodySecondary}
                  rows={3}
                  placeholder="ex: Locurile sunt limitate. Înscrierea se face în ordinea solicitărilor."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update('bodySecondary', e.target.value)}
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Orar și locație</SectionTitle>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="scheduleDays" label="Zile de curs" hint="ex: Sâmbătă & Duminică">
                <TextInput id="scheduleDays" name="scheduleDays" value={data.scheduleDays} placeholder="ex: Sâmbătă & Duminică" onChange={onText('scheduleDays')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="scheduleTimes" label="Ore de curs" hint="ex: 10:00–10:50 & 11:00–11:50">
                <TextInput id="scheduleTimes" name="scheduleTimes" value={data.scheduleTimes} placeholder="ex: 10:00–10:50 & 11:00–11:50" onChange={onText('scheduleTimes')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="locationName" label="Locație" hint="Numele locației unde se desfășoară cursurile, ex: AFI Cotroceni">
                <TextInput id="locationName" name="locationName" value={data.locationName} placeholder="ex: AFI Cotroceni" onChange={onText('locationName')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Butoane principale</SectionTitle>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="ctaPrimaryLabel" label="Text buton primar" hint="ex: Înscrie-te">
                <TextInput id="ctaPrimaryLabel" name="ctaPrimaryLabel" value={data.ctaPrimaryLabel} placeholder="ex: Înscrie-te" onChange={onText('ctaPrimaryLabel')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="ctaPrimaryUrl" label="Link buton primar" hint="ex: /inscrieri">
                <TextInput id="ctaPrimaryUrl" name="ctaPrimaryUrl" value={data.ctaPrimaryUrl} placeholder="ex: /inscrieri" onChange={onText('ctaPrimaryUrl')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="ctaSecondaryLabel" label="Text buton secundar" hint="ex: Află mai mult">
                <TextInput id="ctaSecondaryLabel" name="ctaSecondaryLabel" value={data.ctaSecondaryLabel} placeholder="ex: Află mai mult" onChange={onText('ctaSecondaryLabel')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="ctaSecondaryUrl" label="Link buton secundar" hint="ex: /inscrieri">
                <TextInput id="ctaSecondaryUrl" name="ctaSecondaryUrl" value={data.ctaSecondaryUrl} placeholder="ex: /inscrieri" onChange={onText('ctaSecondaryUrl')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Link prețuri</SectionTitle>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="pricesLinkLabel" label="Text link prețuri" hint="ex: Vezi prețurile">
                <TextInput id="pricesLinkLabel" name="pricesLinkLabel" value={data.pricesLinkLabel} placeholder="ex: Vezi prețurile" onChange={onText('pricesLinkLabel')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="pricesLinkUrl" label="Link spre prețuri" hint="ex: /inscrieri#preturi">
                <TextInput id="pricesLinkUrl" name="pricesLinkUrl" value={data.pricesLinkUrl} placeholder="ex: /inscrieri#preturi" onChange={onText('pricesLinkUrl')} />
              </EditorField>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
