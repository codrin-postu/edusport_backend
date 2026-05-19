import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Divider, Grid, Textarea, TextInput, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface RegistrationClosedData {
  heading: string;
  body: string;
  whatsappLabel: string;
  whatsappUrl: string;
  contactLabel: string;
  contactUrl: string;
}

const EMPTY: RegistrationClosedData = {
  heading: '',
  body: '',
  whatsappLabel: '',
  whatsappUrl: '',
  contactLabel: '',
  contactUrl: '',
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

export default function HomepageRegistrationClosedEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<RegistrationClosedData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, ...(v as RegistrationClosedData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as RegistrationClosedData) });
  }, [field.value]);

  const update = (key: keyof RegistrationClosedData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  const onText =
    (key: keyof RegistrationClosedData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      update(key, e.target.value);

  return (
    <Box width="100%">
      <EditorCard
        title="Secțiunea Înscrieri Închise"
        description="Afișată când înscrierile sunt închise (controlat din Setări Site). Anunță vizitatorii că sezonul s-a terminat și îi invită să rămână conectați."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="heading" label="Titlu secțiune" hint="Mesajul principal, ex: Ne vedem în următorul sezon!">
                <TextInput id="heading" name="heading" value={data.heading} placeholder="ex: Ne vedem în următorul sezon!" onChange={onText('heading')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="body" label="Text informativ" hint="Mesajul afișat vizitatorilor când înscrierile sunt închise. Separă paragrafele cu o linie goală.">
                <Textarea
                  id="body"
                  name="body"
                  value={data.body}
                  rows={4}
                  placeholder="ex: Mulțumim tuturor celor care s-au alăturat în acest sezon..."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update('body', e.target.value)}
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Butoane de contact</SectionTitle>
            </Grid.Item>

            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="whatsappLabel" label="Text buton WhatsApp" hint="ex: Alătură-te pe WhatsApp">
                <TextInput id="whatsappLabel" name="whatsappLabel" value={data.whatsappLabel} placeholder="ex: Alătură-te pe WhatsApp" onChange={onText('whatsappLabel')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="whatsappUrl" label="Link WhatsApp" hint="ex: https://wa.me/40700000000">
                <TextInput id="whatsappUrl" name="whatsappUrl" value={data.whatsappUrl} placeholder="ex: https://wa.me/40700000000" onChange={onText('whatsappUrl')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="contactLabel" label="Text link contact" hint="ex: Contactează-ne">
                <TextInput id="contactLabel" name="contactLabel" value={data.contactLabel} placeholder="ex: Contactează-ne" onChange={onText('contactLabel')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="contactUrl" label="Link pagina contact" hint="ex: /contact">
                <TextInput id="contactUrl" name="contactUrl" value={data.contactUrl} placeholder="ex: /contact" onChange={onText('contactUrl')} />
              </EditorField>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
