import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Divider, Grid, Textarea, TextInput, Typography } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface AboutData {
  eyebrow: string;
  heading: string;
  content: string;
  locationBullet: string;
  levelsBullet: string;
  coachesBullet: string;
  videoUrl: string;
  videoLabel: string;
}

const EMPTY: AboutData = {
  eyebrow: '',
  heading: '',
  content: '',
  locationBullet: '',
  levelsBullet: '',
  coachesBullet: '',
  videoUrl: '',
  videoLabel: '',
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

export default function CursuriPageAboutEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<AboutData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...EMPTY, ...(v as AboutData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) setData({ ...EMPTY, ...(v as AboutData) });
  }, [field.value]);

  const update = (key: keyof AboutData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  const onText =
    (key: keyof AboutData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      update(key, e.target.value);

  return (
    <Box width="100%">
      <EditorCard
        title="Secțiunea Despre Cursuri"
        description="Prezentarea școlii de patinaj: titlu, text descriptiv, puncte cheie și link video opțional."
      >
        <Box padding={4}>
          <Grid.Root gridCols={12} gap={4}>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="eyebrow" label="Etichetă mică" hint="Textul mic deasupra titlului, ex: Despre noi">
                <TextInput id="eyebrow" name="eyebrow" value={data.eyebrow} placeholder="ex: Despre noi" onChange={onText('eyebrow')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="heading" label="Titlu secțiune" hint="ex: Școala de patinaj EduSport">
                <TextInput id="heading" name="heading" value={data.heading} placeholder="ex: Școala de patinaj EduSport" onChange={onText('heading')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="content" label="Text principal" hint="Descrierea principală. Separă paragrafele cu o linie goală.">
                <Textarea
                  id="content"
                  name="content"
                  value={data.content}
                  rows={5}
                  placeholder="Descrierea principală a școlii..."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update('content', e.target.value)}
                />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Puncte cheie</SectionTitle>
            </Grid.Item>

            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="locationBullet" label="Bullet locație" hint="ex: Patinoar AFI Cotroceni">
                <TextInput id="locationBullet" name="locationBullet" value={data.locationBullet} placeholder="ex: Patinoar AFI Cotroceni" onChange={onText('locationBullet')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="levelsBullet" label="Bullet niveluri" hint="ex: Toate nivelurile de vârstă și experiență">
                <TextInput id="levelsBullet" name="levelsBullet" value={data.levelsBullet} placeholder="ex: Toate nivelurile de vârstă și experiență" onChange={onText('levelsBullet')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={12} s={12} xs={12}>
              <EditorField name="coachesBullet" label="Bullet antrenori" hint="ex: Antrenori cu experiență internațională">
                <TextInput id="coachesBullet" name="coachesBullet" value={data.coachesBullet} placeholder="ex: Antrenori cu experiență internațională" onChange={onText('coachesBullet')} />
              </EditorField>
            </Grid.Item>

            <Grid.Item col={12} s={12} xs={12}>
              <SectionTitle>Video</SectionTitle>
            </Grid.Item>

            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="videoUrl" label="Link video" hint="URL YouTube sau alt video, opțional">
                <TextInput id="videoUrl" name="videoUrl" value={data.videoUrl} placeholder="ex: https://youtube.com/watch?v=..." onChange={onText('videoUrl')} />
              </EditorField>
            </Grid.Item>
            <Grid.Item col={6} s={12} xs={12}>
              <EditorField name="videoLabel" label="Text link video" hint="Textul afișat pe linkul video, ex: Urmărește un curs">
                <TextInput id="videoLabel" name="videoLabel" value={data.videoLabel} placeholder="ex: Urmărește un curs" onChange={onText('videoLabel')} />
              </EditorField>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </EditorCard>
    </Box>
  );
}
