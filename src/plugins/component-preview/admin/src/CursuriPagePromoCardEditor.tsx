import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Divider, Field, Grid, Textarea, TextInput, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { InlineStringList } from './components/InlineStringList';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface PromoCardData {
  eyebrow: string;
  title: string;
  description: string;
  subscriptionInfoTitle: string;
  subscriptionBullets: string[];
}

const EMPTY: PromoCardData = {
  eyebrow: '',
  title: '',
  description: '',
  subscriptionInfoTitle: '',
  subscriptionBullets: [],
};

export default function CursuriPagePromoCardEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<PromoCardData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<PromoCardData>;
      return {
        ...EMPTY,
        ...raw,
        subscriptionBullets: Array.isArray(raw.subscriptionBullets) ? raw.subscriptionBullets : [],
      };
    }
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<PromoCardData>;
      setData({
        ...EMPTY,
        ...raw,
        subscriptionBullets: Array.isArray(raw.subscriptionBullets) ? raw.subscriptionBullets : [],
      });
    }
  }, [field.value]);

  const commit = (next: PromoCardData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof Omit<PromoCardData, 'subscriptionBullets'>, val: string) => {
    commit({ ...data, [key]: val });
  };

  const onText =
    (key: keyof Omit<PromoCardData, 'subscriptionBullets'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update(key, e.target.value);

  return (
    <Box width="100%">
      <EditorCard
        title="Card Promo Abonament"
        description="Cardul albastru care promovează abonamentul de club afișat pe pagina /cursuri."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="eyebrow" label="Etichetă mică" hint="Textul mic deasupra titlului, ex: Devino Membru">
                <TextInput id="eyebrow" name="eyebrow" value={data.eyebrow} placeholder="ex: Devino Membru" onChange={onText('eyebrow')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="title" label="Titlu card" hint="Titlul cardului promo, ex: Abonament de Club">
                <TextInput id="title" name="title" value={data.title} placeholder="ex: Abonament de Club" onChange={onText('title')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="description" label="Descriere" hint="Textul descriptiv al cardului promo">
                <Textarea
                  id="description"
                  name="description"
                  value={data.description}
                  rows={3}
                  placeholder="Descrierea cardului promo..."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update('description', e.target.value)}
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <Box paddingBottom={2}>
                <Divider />
              </Box>
              <Typography variant="pi" fontWeight="semiBold" textColor="neutral600">
                Informații abonament
              </Typography>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField
                name="subscriptionInfoTitle"
                label="Titlu info abonament"
                hint="Titlul listei de informații, ex: Ce include abonamentul?"
              >
                <TextInput
                  id="subscriptionInfoTitle"
                  name="subscriptionInfoTitle"
                  value={data.subscriptionInfoTitle}
                  placeholder="ex: Ce include abonamentul?"
                  onChange={onText('subscriptionInfoTitle')}
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <Field.Root id={`${name}-bullets`} name="subscriptionBullets" hint="Câte un punct pe rând" width="100%">
                <Field.Label>Informații abonament</Field.Label>
                <Box paddingTop={2}>
                  <InlineStringList
                    items={data.subscriptionBullets}
                    onChange={(subscriptionBullets) => commit({ ...data, subscriptionBullets })}
                    idPrefix={`${name}-bullet`}
                    ariaItemLabel="Punct"
                    addLabel="Adaugă punct"
                    emptyLabel="Nicio intrare"
                  />
                </Box>
                <Field.Hint />
              </Field.Root>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
