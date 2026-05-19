import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  Field,
  Flex,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import { EditorCard } from './components/EditorCard';
import { DeleteIconButton } from './components/DeleteIconButton';
import { AddListButton } from './components/AddListButton';

function CourseInput({
  id,
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  id: string;
  value: string;
  onChange: (val: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <Flex gap={2} alignItems="center" style={{ width: '100%' }}>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <TextInput
          id={id}
          aria-label={id}
          value={value}
          placeholder="ex: Primii Pași"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      </Box>
      {canRemove && <DeleteIconButton onClick={onRemove} label="Șterge" variant="subtle" />}
    </Flex>
  );
}

interface ScheduleGroup {
  timeSlot: string;
  courses: string[];
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

export default function ScheduleGroupsEditor({ name }: Props) {
  const field = useField(name);

  const [groups, setGroups] = React.useState<ScheduleGroup[]>(() =>
    Array.isArray(field.value) ? (field.value as ScheduleGroup[]) : [],
  );

  React.useEffect(() => {
    if (Array.isArray(field.value)) setGroups(field.value as ScheduleGroup[]);
  }, [field.value]);

  const commit = (next: ScheduleGroup[]) => {
    setGroups(next);
    field.onChange(name, next);
  };

  const addGroup = () =>
    commit([...groups, { timeSlot: '', courses: [''] }]);
  const removeGroup = (i: number) => commit(groups.filter((_, idx) => idx !== i));
  const updateGroup = (i: number, patch: Partial<ScheduleGroup>) =>
    commit(groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  const addCourse = (gi: number) => {
    const g = groups[gi];
    updateGroup(gi, { courses: [...g.courses, ''] });
  };
  const removeCourse = (gi: number, ci: number) => {
    const g = groups[gi];
    updateGroup(gi, { courses: g.courses.filter((_, i) => i !== ci) });
  };
  const updateCourse = (gi: number, ci: number, val: string) => {
    const g = groups[gi];
    updateGroup(gi, { courses: g.courses.map((c, i) => (i === ci ? val : c)) });
  };

  return (
    <Box width="100%">
      <EditorCard
        title="Serii orar"
        description="Fiecare serie are un interval orar și lista de grupe de cursanți."
      >
        <Box padding={4}>
            {groups.length === 0 ? (
              <Box paddingTop={3} paddingBottom={3}>
                <Typography variant="omega" textColor="neutral500" fontStyle="italic">
                  Nicio serie adăugată
                </Typography>
              </Box>
            ) : (
              <Flex direction="column" gap={0} alignItems="stretch">
                {groups.map((group, gi) => (
                  <Box
                    key={gi}
                    paddingTop={gi === 0 ? 0 : 4}
                    paddingBottom={4}
                    borderColor="neutral200"
                    borderStyle="solid"
                    borderWidth={gi === groups.length - 1 ? '0' : '0 0 1px 0'}
                  >
                    <Flex justifyContent="space-between" alignItems="center" paddingBottom={3}>
                      <Typography variant="pi" fontWeight="bold" textColor="neutral500">
                        Seria #{gi + 1}
                      </Typography>
                      <DeleteIconButton
                        onClick={() => removeGroup(gi)}
                        label={`Șterge seria ${gi + 1}`}
                        variant="danger"
                      />
                    </Flex>

                    <Flex direction="column" gap={3} alignItems="stretch">
                      <Field.Root
                        id={`${name}-${gi}-timeslot`}
                        name={`${name}-${gi}-timeslot`}
                        required
                        error={!group.timeSlot ? 'Obligatoriu' : undefined}
                      >
                        <Field.Label>Interval orar</Field.Label>
                        <TextInput
                          id={`${name}-${gi}-timeslot`}
                          value={group.timeSlot}
                          placeholder="ex: 10:00 - 10:50"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateGroup(gi, { timeSlot: e.target.value })
                          }
                        />
                        <Field.Error />
                      </Field.Root>

                      <Field.Root id={`${name}-${gi}-courses`} name={`${name}-${gi}-courses`}>
                        <Field.Label>Grupe cursanți</Field.Label>
                        <Box paddingTop={2}>
                          <Flex direction="column" gap={2} alignItems="stretch">
                            {group.courses.map((course, ci) => (
                              <CourseInput
                                key={ci}
                                id={`${name}-${gi}-course-${ci}`}
                                value={course}
                                onChange={(val) => updateCourse(gi, ci, val)}
                                onRemove={() => removeCourse(gi, ci)}
                                canRemove={group.courses.length > 1}
                              />
                            ))}
                            <Flex>
                              <Button
                                onClick={() => addCourse(gi)}
                                variant="tertiary"
                                size="S"
                                startIcon={<Plus />}
                              >
                                Adaugă grupă
                              </Button>
                            </Flex>
                          </Flex>
                        </Box>
                      </Field.Root>
                    </Flex>
                  </Box>
                ))}
              </Flex>
            )}
            <Box
              paddingTop={groups.length === 0 ? 0 : 4}
              borderColor={groups.length === 0 ? undefined : 'neutral200'}
              borderStyle={groups.length === 0 ? undefined : 'solid'}
              borderWidth={groups.length === 0 ? undefined : '1px 0 0 0'}
            >
              <AddListButton onClick={addGroup} label="Adaugă serie nouă" />
            </Box>
        </Box>
      </EditorCard>
    </Box>
  );
}
