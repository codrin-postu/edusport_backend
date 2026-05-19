import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  Checkbox,
  Field,
  Flex,
  IconButton,
  Textarea,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { Plus, Drag, Trash, ChevronUp, ChevronDown } from '@strapi/icons';
import { EditorCard } from './components/EditorCard';

interface Rule {
  label: string;
  text: string;
  highlight: boolean;
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

export default function RulesTable({ name }: Props) {
  const field = useField(name);

  const fieldRules: Rule[] = Array.isArray(field.value) ? (field.value as Rule[]) : [];
  const [localRules, setLocalRules] = React.useState<Rule[]>(fieldRules);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const isDragging = React.useRef(false);
  const dragFrom = React.useRef<number | null>(null);
  const dragTo = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!isDragging.current) {
      setLocalRules(Array.isArray(field.value) ? (field.value as Rule[]) : []);
    }
  }, [field.value]);

  const commit = (rules: Rule[]) => {
    setLocalRules(rules);
    field.onChange(name, rules);
  };

  const update = <K extends keyof Rule>(index: number, key: K, value: Rule[K]) =>
    commit(localRules.map((r, i) => (i === index ? { ...r, [key]: value } : r)));

  const addRow = () => {
    const next = [...localRules, { label: '', text: '', highlight: false }];
    commit(next);
    setExpanded((prev) => new Set(prev).add(next.length - 1));
  };

  const removeRow = (index: number) => {
    commit(localRules.filter((_, i) => i !== index));
    setExpanded((prev) => {
      const s = new Set<number>();
      prev.forEach((n) => {
        if (n < index) s.add(n);
        else if (n > index) s.add(n - 1);
      });
      return s;
    });
  };

  const toggleExpand = (index: number) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(index)) s.delete(index);
      else s.add(index);
      return s;
    });

  // Native HTML5 drag with reorder-on-hover. Drag handle alone initiates the drag.
  const onHandleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    isDragging.current = true;
    dragFrom.current = index;
    dragTo.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const onCardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const from = dragFrom.current;
    if (from === null || from === index) return;
    if (dragTo.current === index) return;
    dragTo.current = index;
    const arr = [...localRules];
    const [moved] = arr.splice(from, 1);
    arr.splice(index, 0, moved);
    dragFrom.current = index;
    setLocalRules(arr);
  };

  const onCardDragEnd = () => {
    isDragging.current = false;
    field.onChange(name, localRules);
    dragFrom.current = null;
    dragTo.current = null;
  };

  const headerAction = (
    <Button onClick={addRow} variant="secondary" size="S" startIcon={<Plus />}>
      Adaugă regulă
    </Button>
  );

  return (
    <Box width="100%">
      <EditorCard
        title="Reguli"
        description="Trage de mâner pentru a reordona. Fiecare rând are o etichetă, un text și o opțiune de evidențiere."
        headerAction={headerAction}
      >
        <Box padding={4}>
          {localRules.length === 0 ? (
            <Box paddingTop={3} paddingBottom={3}>
              <Typography variant="omega" textColor="neutral500" fontStyle="italic">
                Nicio regulă adăugată
              </Typography>
            </Box>
          ) : (
            <Flex direction="column" gap={2} alignItems="stretch">
              {localRules.map((rule, i) => {
                const isExpanded = expanded.has(i);
                const isBeingDragged = isDragging.current && dragFrom.current === i;
                return (
                  <Box
                    key={i}
                    onDragOver={(e: React.DragEvent) => onCardDragOver(e, i)}
                    onDragEnd={onCardDragEnd}
                    background={rule.highlight ? 'warning100' : 'neutral0'}
                    borderColor={rule.highlight ? 'warning500' : 'neutral200'}
                    borderStyle="solid"
                    borderWidth="1px"
                    borderRadius="4px"
                    padding={2}
                    style={{ opacity: isBeingDragged ? 0.4 : 1 }}
                  >
                    <Flex gap={2} alignItems="center">
                      <Box
                        draggable
                        onDragStart={(e: React.DragEvent) => onHandleDragStart(e, i)}
                        style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
                        title="Trage pentru a reordona"
                        aria-label="Trage pentru a reordona"
                      >
                        <Drag />
                      </Box>
                      <Typography variant="pi" fontWeight="bold" textColor="neutral500">
                        {i + 1}.
                      </Typography>
                      <Box flex="1" minWidth="0">
                        <Typography
                          variant="omega"
                          fontWeight={rule.highlight ? 'bold' : 'semiBold'}
                          textColor={rule.label ? 'neutral800' : 'neutral400'}
                          ellipsis
                        >
                          {rule.label || 'Fără titlu'}
                        </Typography>
                      </Box>
                      <IconButton
                        onClick={() => toggleExpand(i)}
                        label={isExpanded ? 'Restrânge' : 'Extinde'}
                      >
                        {isExpanded ? <ChevronUp /> : <ChevronDown />}
                      </IconButton>
                      <IconButton
                        onClick={() => removeRow(i)}
                        label={`Șterge regula ${i + 1}`}
                        variant="danger-light"
                      >
                        <Trash />
                      </IconButton>
                    </Flex>

                    {isExpanded && (
                      <Box paddingTop={3}>
                        <Flex direction="column" gap={3} alignItems="stretch">
                          <Field.Root id={`${name}-${i}-label`} name={`${name}-${i}-label`}>
                            <Field.Label>Etichetă scurtă</Field.Label>
                            <TextInput
                              id={`${name}-${i}-label`}
                              value={rule.label}
                              placeholder="Etichetă scurtă…"
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                update(i, 'label', e.target.value)
                              }
                            />
                          </Field.Root>
                          <Field.Root id={`${name}-${i}-text`} name={`${name}-${i}-text`}>
                            <Field.Label>Text complet</Field.Label>
                            <Textarea
                              id={`${name}-${i}-text`}
                              value={rule.text}
                              rows={3}
                              placeholder="Textul complet al regulii…"
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                update(i, 'text', e.target.value)
                              }
                            />
                          </Field.Root>
                          <Checkbox
                            checked={rule.highlight}
                            onCheckedChange={(checked) =>
                              update(i, 'highlight', Boolean(checked))
                            }
                          >
                            Evidențiază această regulă
                          </Checkbox>
                        </Flex>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Flex>
          )}
        </Box>
      </EditorCard>
    </Box>
  );
}
