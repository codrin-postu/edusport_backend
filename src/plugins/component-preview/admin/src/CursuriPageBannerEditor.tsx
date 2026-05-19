import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Divider, Grid, TextInput, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface BannerData {
  title: string;
  scheduleDays: string;
  scheduleTimes: string;
  locationName: string;
  locationUrl: string;
}

const EMPTY: BannerData = {
  title: '',
  scheduleDays: '',
  scheduleTimes: '',
  locationName: '',
  locationUrl: '',
};

export default function CursuriPageBannerEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<BannerData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as BannerData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as BannerData) });
  }, [field.value]);

  const update = (key: keyof BannerData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  const onText =
    (key: keyof BannerData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      update(key, e.target.value);

  return (
    <Box width="100%">
      <EditorCard
        title="Banner Pagina Cursuri"
        description="Titlul și informațiile de orar afișate în header-ul paginii /cursuri."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField
                name="title"
                label="Titlu banner"
                hint="Titlul mare afișat pe banner-ul paginii, ex: Cursuri de Patinaj"
              >
                <TextInput
                  id="title"
                  name="title"
                  value={data.title}
                  placeholder="ex: Cursuri de Patinaj"
                  onChange={onText('title')}
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <Box paddingBottom={2}>
                <Divider />
              </Box>
              <Typography variant="pi" fontWeight="semiBold" textColor="neutral600">
                Orar și locație
              </Typography>
            </Grid.Item>

            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="scheduleDays" label="Zile de curs" hint="ex: Sâmbătă & Duminică">
                <TextInput
                  id="scheduleDays"
                  name="scheduleDays"
                  value={data.scheduleDays}
                  placeholder="ex: Sâmbătă & Duminică"
                  onChange={onText('scheduleDays')}
                />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField
                name="scheduleTimes"
                label="Ore de curs"
                hint="ex: 10:00–10:50 & 11:00–11:50"
              >
                <TextInput
                  id="scheduleTimes"
                  name="scheduleTimes"
                  value={data.scheduleTimes}
                  placeholder="ex: 10:00–10:50 & 11:00–11:50"
                  onChange={onText('scheduleTimes')}
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={6} s={12} xs={12}>
              <EditorField
                name="locationName"
                label="Locație"
                hint="Numele locației, ex: AFI Cotroceni"
              >
                <TextInput
                  id="locationName"
                  name="locationName"
                  value={data.locationName}
                  placeholder="ex: AFI Cotroceni"
                  onChange={onText('locationName')}
                />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField
                name="locationUrl"
                label="Link locație"
                hint="URL Google Maps sau altă pagină a locației"
              >
                <TextInput
                  id="locationUrl"
                  name="locationUrl"
                  value={data.locationUrl}
                  placeholder="ex: https://maps.google.com/..."
                  onChange={onText('locationUrl')}
                />
              </EditorField>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
