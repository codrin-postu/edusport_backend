import * as React from 'react';
import { Checkbox, Notice, StatTile, useIsPhone } from '../../ui';
import { NEW_SEASON_COPY, step1Rows } from '../../../club/groups/copy';
import type { StartPreview } from '../../../club/groups/new-season/preview';
import type { StartData, StartGroup, StartSection } from '../../../club/groups/new-season/start-data';
import {
  childMain, headerState, inLine, membersEnabled, programCell, programEnabled, setSection, toggleChild, toggleGroup, type TickKey, type Ticks,
} from '../../../club/groups/new-season/window-view';

type StepProps = { data: StartData; ticks: Ticks; setTicks: (t: Ticks) => void; preview: StartPreview | null };

/** Step 1 (10.2): what changes when the season becomes current; nothing written yet. */
export function StepOne({ data }: { data: StartData }) {
  const rows = step1Rows(data.current.label, data.target.label, data.target.fee);
  const list = (part: typeof rows) => <dl className="grp-kv">{part.map((r) => <React.Fragment key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></React.Fragment>)}</dl>;
  return (
    <>
      <p>{NEW_SEASON_COPY.lead1(data.target.label)}</p>
      <h3>{NEW_SEASON_COPY.onSite}</h3>
      {list(rows.slice(0, 4))}
      <h3>{NEW_SEASON_COPY.inPanel}</h3>
      {list(rows.slice(4))}
    </>
  );
}

function HeaderBox({ section, ticks, setTicks, k, label }: { section: StartSection; ticks: Ticks; setTicks: (t: Ticks) => void; k: TickKey; label: string }) {
  const h = headerState(section, ticks, k);
  return <Checkbox checked={h.checked} indeterminate={h.indeterminate} disabled={h.disabled} onChange={(on) => setTicks(setSection(section, ticks, k, on))} label={label} />;
}

function Children({ g, p }: { g: StartGroup; p: StepProps }) {
  const tick = p.ticks[g.groupId];
  return (
    <div className="grp-pick">
      {g.athletes.map((a) => {
        const m = childMain(a, g.groupId, p.preview?.mains ?? {}, p.data.current.label);
        return (
          <div key={a.athleteId} className="grp-usual-row">
            <Checkbox checked={!a.inactive && tick.members && !tick.excluded.includes(a.athleteId)} disabled={a.inactive || !tick.members} onChange={() => p.setTicks(toggleChild(p.ticks, g.groupId, a.athleteId))} label={a.age === null ? a.name : `${a.name}, ${a.age} ani`} />
            <span>{m.main}</span>
            {m.note && <span className="spv-muted">{m.note}</span>}
          </div>
        );
      })}
    </div>
  );
}

function GroupRow({ g, p }: { g: StartGroup; p: StepProps }) {
  const [open, setOpen] = React.useState(false);
  const tick = p.ticks[g.groupId];
  return (
    <div className="grp-ua-row">
      <div><span className="spv-name">{g.name}</span><span className="grp-ua-src">{inLine(g)}</span>
        {g.members > 0 && <button type="button" className="spv-link" onClick={() => setOpen((o) => !o)}>{open ? NEW_SEASON_COPY.hide : NEW_SEASON_COPY.seeAthletes}</button>}
      </div>
      <Checkbox checked={tick.members} disabled={!membersEnabled(g)} onChange={() => p.setTicks(toggleGroup(p.ticks, g, 'members'))} label={NEW_SEASON_COPY.colMembers} />
      <Checkbox checked={tick.program} disabled={!programEnabled(g)} onChange={() => p.setTicks(toggleGroup(p.ticks, g, 'program'))} label={programCell(g, p.data.target.label)} />
      {open && <Children g={g} p={p} />}
    </div>
  );
}

function SectionTable({ s, p, phone }: { s: StartSection; p: StepProps; phone: boolean }) {
  return (
    <section>
      <h3>{s.label}</h3>
      <div className="grp-bar">
        <HeaderBox section={s} ticks={p.ticks} setTicks={p.setTicks} k="members" label={phone ? NEW_SEASON_COPY.phoneAllMembers : NEW_SEASON_COPY.colMembers} />
        <HeaderBox section={s} ticks={p.ticks} setTicks={p.setTicks} k="program" label={phone ? NEW_SEASON_COPY.phoneAllProgram : NEW_SEASON_COPY.colProgram} />
      </div>
      <div className="grp-ua">{s.groups.map((g) => <GroupRow key={g.groupId} g={g} p={p} />)}</div>
    </section>
  );
}

/** Step 2 (10.2): one table per section, the header ticks, "Vezi sportivii", the rule line and the summary. */
export function StepTwo(p: StepProps) {
  const phone = useIsPhone();
  return (
    <>
      <p>{NEW_SEASON_COPY.lead2(p.data.target.label, p.data.current.label)}</p>
      {p.data.sections.map((s) => <SectionTable key={s.sectionId} s={s} p={p} phone={phone} />)}
      <p className="spv-muted">{NEW_SEASON_COPY.mainRule}</p>
      {p.preview && <Notice tone="info">{p.preview.summary}</Notice>}
    </>
  );
}

/** Step 3 (10.2): four tiles, the lines with their bold part, the warning. */
export function StepThree({ preview }: { preview: StartPreview }) {
  return (
    <>
      <div className="grp-bar">{preview.tiles.map((t) => <StatTile key={t.label} label={t.label} value={t.value} caption={t.hint} />)}</div>
      <ul className="grp-usual">{preview.lines.map((l) => <li key={l.bold}><b>{l.bold}</b>{l.rest}</li>)}</ul>
      {preview.warning && <Notice tone="warning">{preview.warning}</Notice>}
    </>
  );
}
