import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Divider, Field, Grid, TextInput, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { InlineStringList } from './components/InlineStringList';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface InfoSectionData {
  sectionLabel: string;
  tips: string[];
  closingLine: string;
}

const EMPTY: InfoSectionData = {
  sectionLabel: '',
  tips: [],
  closingLine: '',
};

export default function CursuriPageInfoSectionEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<InfoSectionData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<InfoSectionData>;
      return { ...EMPTY, ...raw, tips: Array.isArray(raw.tips) ? raw.tips : [] };
    }
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<InfoSectionData>;
      setData({ ...EMPTY, ...raw, tips: Array.isArray(raw.tips) ? raw.tips : [] });
    }
  }, [field.value]);

  const commit = (next: InfoSectionData) => {
    setData(next);
    field.onChange(name, next);
  };

  const update = (key: keyof Omit<InfoSectionData, 'tips'>, val: string) => {
    commit({ ...data, [key]: val });
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Secțiunea Informații Practice"
        description="Sfaturile și regulile afișate la finalul paginii /cursuri (secțiunea Ce trebuie să știi)."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="sectionLabel" label="Titlu secțiune" hint="ex: Ce trebuie să știi">
                <TextInput
                  id="sectionLabel"
                  name="sectionLabel"
                  value={data.sectionLabel}
                  placeholder="ex: Ce trebuie să știi"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('sectionLabel', e.target.value)}
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <Box paddingBottom={2}>
                <Divider />
              </Box>
              <Field.Root id={`${name}-tips`} name="tips" hint="Câte un sfat sau regulă pe rând" width="100%">
                <Field.Label>
                  <Typography variant="pi" fontWeight="semiBold" textColor="neutral600">
                    Sfaturi & reguli
                  </Typography>
                </Field.Label>
                <Box paddingTop={2}>
                  <InlineStringList
                    items={data.tips}
                    onChange={(tips) => commit({ ...data, tips })}
                    idPrefix={`${name}-tip`}
                    ariaItemLabel="Sfat"
                    addLabel="Adaugă sfat"
                    emptyLabel="Nicio intrare"
                  />
                </Box>
                <Field.Hint />
              </Field.Root>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField
                name="closingLine"
                label="Linie de închidere"
                hint="Textul final afișat după lista de sfaturi, opțional"
              >
                <TextInput
                  id="closingLine"
                  name="closingLine"
                  value={data.closingLine}
                  placeholder="ex: Ne rezervăm dreptul de a modifica orarul..."
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('closingLine', e.target.value)}
                />
              </EditorField>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
