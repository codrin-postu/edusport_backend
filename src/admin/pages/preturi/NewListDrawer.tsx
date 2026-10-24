import * as React from 'react';
import { Button, Drawer, DrawerSection, Field, Input, Select, useSaveState } from '../../ui';
import type { AdminSection } from '../../../club/price-admin';
import { LISTS_API, type PricesState } from './usePrices';

export interface NewListDrawerProps {
  open: boolean;
  sections: AdminSection[];
  /** The tab the admin is on; preselected. */
  sectionId: string;
  mutate: PricesState['mutate'];
  onClose: () => void;
}

function Footer({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <>
      <span style={{ flex: 1 }} />
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
        Anulează
      </Button>
      <Button variant="primary" size="sm" loading={saving} onClick={onSave}>
        Salvează
      </Button>
    </>
  );
}

/** "+ Listă nouă": name and school. */
export function NewListDrawer({ open, sections, sectionId, mutate, onClose }: NewListDrawerProps) {
  const [name, setName] = React.useState('');
  const [section, setSection] = React.useState(sectionId);
  const state = useSaveState();
  React.useEffect(() => {
    if (!open) return;
    setName('');
    setSection(sectionId);
    state.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sectionId]);
  const save = async () => (await state.run(() => mutate((c) => c.post(LISTS_API, { name, sectionId: section })))) && onClose();
  const footer = <Footer saving={state.saving} onCancel={onClose} onSave={() => void save()} />;
  return (
    <Drawer open={open} onClose={onClose} title="Listă nouă" dismissable={!state.saving} footer={footer}>
      <DrawerSection>
        <Field label="Nume" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Secțiune">
          <Select value={section} options={sections.map((s) => ({ value: s.documentId, label: s.name }))} onChange={setSection} />
        </Field>
      </DrawerSection>
    </Drawer>
  );
}
