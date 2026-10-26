import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Select, Tabs } from '../../ui';
import { INSCRIERI_PENDING_COPY, LIST_COPY } from '../../../club/inscrieri-copy';
import { CLUB_URLS, moveTargets, schoolTabs, type ListMeta } from '../../../club/inscrieri-panel';
import { moveSchool } from './moves';
import { useStableClient } from './useClient';

const EXISTING_OPTIONS = [
  { value: 'da', label: LIST_COPY.yes },
  { value: 'nu', label: LIST_COPY.no },
];

/** "Sportiv existent: Da / Nu" in the current toolbar (spec 3.1, gaps #22). */
export function ExistingFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <span className="ins-exf">
      <span className="sbt-lbl">{LIST_COPY.existing}:</span>
      <Select aria-label={LIST_COPY.existing} value={value} onChange={onChange} placeholder={LIST_COPY.all} options={EXISTING_OPTIONS} />
    </span>
  );
}

/** Shown while one registration is opened by address (`?open=`): back to the full list. */
export function BackToList() {
  const navigate = useNavigate();
  return (
    <div className="ins-back">
      <button type="button" className="ins-link" onClick={() => navigate({ search: '' })}>
        {INSCRIERI_PENDING_COPY.backToList}
      </button>
    </div>
  );
}

/** "Toate (n)", "<școală> (n)" (spec 3.6): built now, shown only with 2+ schools. */
export function SchoolTabs({ meta, value, onChange }: { meta: ListMeta; value: string; onChange: (id: string) => void }) {
  if (!meta.multipleSchools) return null;
  return <Tabs className="ins-schools" label={LIST_COPY.school} items={schoolTabs(meta)} value={value} onChange={onChange} />;
}

/** Bulk "Mută la altă școală" with a school picker (spec 3.1, 3.6); confirmed rows are left out by the server. */
export function BulkMoveSchool({ ids, meta, done }: { ids: string[]; meta: ListMeta; done: () => void }) {
  const { post } = useStableClient();
  const [target, setTarget] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const school = meta.schools.find((s) => s.documentId === target);
  const move = async () => {
    if (!school) return;
    setBusy(true);
    const ok = await moveSchool(post, CLUB_URLS.moveSchoolBulk, { documentIds: ids, sectionId: school.documentId }, school.name, false);
    setBusy(false);
    if (ok) done();
  };
  return (
    <>
      <Select aria-label={LIST_COPY.school} value={target} onChange={setTarget} options={moveTargets(meta, null)} />
      <Button size="sm" onClick={() => void move()} loading={busy} disabled={!school}>
        {LIST_COPY.moveSchool}
      </Button>
    </>
  );
}
