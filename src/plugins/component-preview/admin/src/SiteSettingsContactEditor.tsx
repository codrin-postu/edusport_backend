import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Divider, Grid, TextInput, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface ContactData {
  phone: string;
  email: string;
  facebookUrl1: string;
  instagramUrl: string;
  whatsappChannelUrl: string;
  addressDisplay: string;
}

const EMPTY: ContactData = {
  phone: '',
  email: '',
  facebookUrl1: '',
  instagramUrl: '',
  whatsappChannelUrl: '',
  addressDisplay: '',
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

export default function SiteSettingsContactEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<ContactData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as ContactData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as ContactData) });
  }, [field.value]);

  const update = (key: keyof ContactData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  const onText =
    (key: keyof ContactData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      update(key, e.target.value);

  return (
    <Box width="100%">
      <EditorCard
        title="Date de Contact & Rețele Sociale"
        description="Informații afișate în footer-ul site-ului și pe paginile de contact. Modificările se reflectă pe tot site-ul."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="phone" label="Număr telefon" hint="Cu sau fără spații - link-ul tel: se generează automat">
                <TextInput id="phone" name="phone" value={data.phone} placeholder="ex: 0723 623 712" onChange={onText('phone')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="email" label="Adresă email">
                <TextInput id="email" name="email" type="email" value={data.email} placeholder="ex: scoala.de.patinaj@gmail.com" onChange={onText('email')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Rețele Sociale</SectionTitle>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="facebookUrl1" label="Facebook">
                <TextInput id="facebookUrl1" name="facebookUrl1" value={data.facebookUrl1} placeholder="ex: https://facebook.com/edusport" onChange={onText('facebookUrl1')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="instagramUrl" label="Instagram">
                <TextInput id="instagramUrl" name="instagramUrl" value={data.instagramUrl} placeholder="ex: https://instagram.com/edusport" onChange={onText('instagramUrl')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="whatsappChannelUrl" label="Canal WhatsApp" hint="Link către canalul de WhatsApp">
                <TextInput id="whatsappChannelUrl" name="whatsappChannelUrl" value={data.whatsappChannelUrl} placeholder="ex: https://whatsapp.com/channel/..." onChange={onText('whatsappChannelUrl')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Adresă</SectionTitle>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="addressDisplay" label="Adresă afișată" hint="Textul adresei care apare pe site">
                <TextInput id="addressDisplay" name="addressDisplay" value={data.addressDisplay} placeholder="ex: Patinoarul AFI Cotroceni, București" onChange={onText('addressDisplay')} />
              </EditorField>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
