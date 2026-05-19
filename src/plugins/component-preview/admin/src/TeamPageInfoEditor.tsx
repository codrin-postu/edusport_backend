import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Grid, Textarea } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface TeamPageInfoData {
  introText: string;
}

const EMPTY: TeamPageInfoData = {
  introText: '',
};

export default function TeamPageInfoEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<TeamPageInfoData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, ...(v as TeamPageInfoData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as TeamPageInfoData) });
  }, [field.value]);

  const update = (key: keyof TeamPageInfoData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Pagina Echipă - Introducere"
        description="Textul de introducere afișat înainte de lista de membri pe pagina /despre-noi/echipa."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField
                name="introText"
                label="Text introducere"
                hint="Paragraful de introducere afișat înainte de lista de membri"
              >
                <Textarea
                  id="introText"
                  name="introText"
                  value={data.introText}
                  rows={4}
                  placeholder="Textul de introducere al paginii echipei..."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    update('introText', e.target.value)
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
