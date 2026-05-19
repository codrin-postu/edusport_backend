import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Box, Flex, Textarea, TextInput } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

interface HistoricPageInfoData {
  sectionHeading: string;
  sectionSubheading: string;
  introText: string;
}

const EMPTY: HistoricPageInfoData = {
  sectionHeading: '',
  sectionSubheading: '',
  introText: '',
};

export default function HistoricPageInfoEditor({ name }: Props) {
  const field = useField(name);

  const [data, setData] = React.useState<HistoricPageInfoData>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      return { ...EMPTY, ...(v as HistoricPageInfoData) };
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v))
      setData({ ...EMPTY, ...(v as HistoricPageInfoData) });
  }, [field.value]);

  const update = (key: keyof HistoricPageInfoData, val: string) => {
    const next = { ...data, [key]: val };
    setData(next);
    field.onChange(name, next);
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Pagina Istoric - Secțiunea Principală"
        description="Titlurile și textul introductiv al secțiunii cu timeline și statistici."
      >
        <Box padding={4}>
          <Flex direction="column" gap={4} alignItems="stretch">
            <Flex gap={4} alignItems="flex-start" wrap="wrap">
              <Box style={{ flex: '1 1 200px', minWidth: 0 }}>
                <EditorField
                  name="sectionHeading"
                  label="Titlu secțiune principală"
                  hint="Titlul secțiunii cu timeline și statistici"
                >
                  <TextInput
                    id="sectionHeading"
                    name="sectionHeading"
                    value={data.sectionHeading}
                    placeholder="ex: Povestea noastră"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      update('sectionHeading', e.target.value)
                    }
                  />
                </EditorField>
              </Box>

              <Box style={{ flex: '1 1 200px', minWidth: 0 }}>
                <EditorField
                  name="sectionSubheading"
                  label="Subtitlu secțiune"
                  hint="Subtitlul de sub titlul secțiunii principale"
                >
                  <TextInput
                    id="sectionSubheading"
                    name="sectionSubheading"
                    value={data.sectionSubheading}
                    placeholder="ex: De la început până astăzi"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      update('sectionSubheading', e.target.value)
                    }
                  />
                </EditorField>
              </Box>
            </Flex>

            <EditorField
              name="introText"
              label="Text introducere"
              hint="Paragraful introductiv afișat la începutul secțiunii principale"
            >
              <Textarea
                id="introText"
                name="introText"
                value={data.introText}
                rows={4}
                placeholder="Textul introductiv al secțiunii principale..."
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  update('introText', e.target.value)
                }
              />
            </EditorField>
          </Flex>
        </Box>
      </EditorCard>
    </Box>
  );
}
