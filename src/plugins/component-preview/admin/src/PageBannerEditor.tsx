import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Grid, Textarea, TextInput } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface BannerData {
  title: string;
  subtitle: string;
}

const EMPTY: BannerData = { title: '', subtitle: '' };

export default function PageBannerEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<BannerData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, ...(v as BannerData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as BannerData) });
  }, [field.value]);

  const update = (key: keyof BannerData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Banner Pagină"
        description="Titlul și subtitlul afișate în banner-ul din partea de sus a paginii."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="title" label="Titlu" hint="Titlul mare afișat în banner">
                <TextInput
                  id="title"
                  name="title"
                  value={data.title}
                  placeholder="ex: Echipa noastră"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    update('title', e.target.value)
                  }
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="subtitle" label="Subtitlu" hint="Textul descriptiv de sub titlu">
                <Textarea
                  id="subtitle"
                  name="subtitle"
                  value={data.subtitle}
                  rows={3}
                  placeholder="ex: Antrenorii și instructorii care ghidează cursanții..."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    update('subtitle', e.target.value)
                  }
                />
              </EditorField>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
