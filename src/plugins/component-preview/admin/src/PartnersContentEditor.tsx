import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Grid, Textarea, TextInput } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { Section } from './components/Section';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface ContentData {
  heroTitle: string;
  heroSubtitle: string;
  introEyebrow: string;
  introHeading: string;
  introBody: string;
  ctaEyebrow: string;
  ctaHeading: string;
  ctaBody: string;
}

const EMPTY: ContentData = {
  heroTitle: '',
  heroSubtitle: '',
  introEyebrow: '',
  introHeading: '',
  introBody: '',
  ctaEyebrow: '',
  ctaHeading: '',
  ctaBody: '',
};

function normalize(value: unknown): ContentData {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...EMPTY, ...(value as Partial<ContentData>) };
  }
  return { ...EMPTY };
}

export default function PartnersContentEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<ContentData>(() => normalize(field.value));

  React.useEffect(() => {
    setData(normalize(field.value));
  }, [field.value]);

  const update = (key: keyof ContentData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  const text = (
    key: keyof ContentData,
    label: string,
    placeholder: string,
    hint?: string,
  ) => (
    <EditorField name={key} label={label} hint={hint}>
      <TextInput
        id={key}
        name={key}
        value={data[key]}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(key, e.target.value)}
      />
    </EditorField>
  );

  const area = (key: keyof ContentData, label: string, placeholder: string, hint?: string) => (
    <EditorField name={key} label={label} hint={hint}>
      <Textarea
        id={key}
        name={key}
        rows={3}
        value={data[key]}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update(key, e.target.value)}
      />
    </EditorField>
  );

  return (
    <Box width="100%">
      <EditorCard
        title="Parteneri - Text pagină"
        description="Textele din antet, secțiunea „De ce parteneriat” și secțiunea de colaborare/sponsorizare."
      >
        <Box padding={4}>
          <Section title="Antet (hero)" first>
            <Grid.Root gridCols={12} gap={4}>
              <Grid.Item col={6} s={12} xs={12}>{text('heroTitle', 'Titlu', 'ex: Parteneri')}</Grid.Item>
              <Grid.Item col={12} s={12} xs={12}>{area('heroSubtitle', 'Subtitlu', 'ex: Împreună cu partenerii și sponsorii noștri...')}</Grid.Item>
            </Grid.Root>
          </Section>

          <Section title="De ce parteneriat">
            <Grid.Root gridCols={12} gap={4}>
              <Grid.Item col={6} s={12} xs={12}>{text('introEyebrow', 'Etichetă mică', 'ex: De ce parteneriat')}</Grid.Item>
              <Grid.Item col={6} s={12} xs={12}>{text('introHeading', 'Titlu secțiune', 'ex: Susține o comunitate în creștere')}</Grid.Item>
              <Grid.Item col={12} s={12} xs={12}>{area('introBody', 'Text', 'ex: Un parteneriat cu clubul înseamnă vizibilitate...')}</Grid.Item>
            </Grid.Root>
          </Section>

          <Section title="Colaborează (secțiunea formular)">
            <Grid.Root gridCols={12} gap={4}>
              <Grid.Item col={6} s={12} xs={12}>{text('ctaEyebrow', 'Etichetă mică', 'ex: Hai să colaborăm')}</Grid.Item>
              <Grid.Item col={6} s={12} xs={12}>{text('ctaHeading', 'Titlu', 'ex: Sponsorizează sau organizează un eveniment')}</Grid.Item>
              <Grid.Item col={12} s={12} xs={12}>{area('ctaBody', 'Text', 'ex: Vrei să sponsorizezi clubul sau să organizăm împreună un eveniment?')}</Grid.Item>
            </Grid.Root>
          </Section>
        </Box>
      </EditorCard>
    </Box>
  );
}
