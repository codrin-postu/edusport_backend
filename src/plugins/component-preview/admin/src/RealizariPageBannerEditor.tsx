import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Grid, Textarea, TextInput } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface RealizariPageBannerData {
  bannerTitle: string;
  bannerSubtitle: string;
}

const EMPTY: RealizariPageBannerData = {
  bannerTitle: '',
  bannerSubtitle: '',
};

export default function RealizariPageBannerEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<RealizariPageBannerData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, ...(v as RealizariPageBannerData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as RealizariPageBannerData) });
  }, [field.value]);

  const update = (key: keyof RealizariPageBannerData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Pagina Realizări - Banner"
        description="Titlul și subtitlul bannerului pentru pagina /despre-noi/realizari."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField
                name="bannerTitle"
                label="Titlu banner"
                hint="ex: Realizările noastre"
              >
                <TextInput
                  id="bannerTitle"
                  name="bannerTitle"
                  value={data.bannerTitle}
                  placeholder="ex: Realizările noastre"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    update('bannerTitle', e.target.value)
                  }
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField
                name="bannerSubtitle"
                label="Subtitlu banner"
                hint="Textul de sub titlul bannerului"
              >
                <Textarea
                  id="bannerSubtitle"
                  name="bannerSubtitle"
                  value={data.bannerSubtitle}
                  rows={3}
                  placeholder="Subtitlul bannerului..."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    update('bannerSubtitle', e.target.value)
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
