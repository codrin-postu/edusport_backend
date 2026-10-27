import * as React from 'react';
import { Checkbox, Notice, StatTile, useIsPhone } from '../../ui';
import { NEW_SEASON_COPY, step1Rows } from '../../../club/groups/copy';
import type { StartPreview } from '../../../club/groups/new-season/preview';
import type { StartAthlete, StartData, StartGroup, StartSection } from '../../../club/groups/new-season/start-data';
import {
  childMain, childPhoneLine, headerState, inLine, membersEnabled, phoneLine, programCell, programEnabled, setSection, toggleChild, toggleGroup, type TickKey, type Ticks,
} from '../../../club/groups/new-season/window-view';

type StepProps = { data: StartData; ticks: Ticks; setTicks: (t: Ticks) => void; preview: StartPreview | null };

/** Step 1 (10.2): what changes when the season becomes current; nothing written yet. */
export function StepOne({ data }: { data: StartData }) {
  const rows = step1Rows(data.current.label, data.target.label, data.target.fee);
  const list = (part: typeof rows) => <dl className="grp-kv grp-kv--rows">{part.map((r) => <React.Fragment key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></React.Fragment>)}</dl>;
  return (
    <>
      <p>{NEW_SEASON_COPY.lead1(data.target.label)}</p>
      <h3 className="ui-sec-title grp-sec">{NEW_SEASON_COPY.onSite}</h3>
      {list(rows.slice(0, 4))}
      <h3 className="ui-sec-title grp-sec">{NEW_SEASON_COPY.inPanel}</h3>
      {list(rows.slice(4))}
    </>
  );
}

function HeaderBox({ section, ticks, setTicks, k, label }: { section: StartSection; ticks: Ticks; setTicks: (t: Ticks) => void; k: TickKey; label: string }) {
  const h = headerState(section, ticks, k);
  return <Checkbox checked={h.checked} indeterminate={h.indeterminate} disabled={h.disabled} onChange={(on) => setTicks(setSection(section, ticks, k, on))} label={label} />;
}

const childName = (a: StartAthlete): string => (a.age === null ? a.name : `${a.name}, ${a.age} ani`);

function childOf(g: StartGroup, a: StartAthlete, p: StepProps) {
  const tick = p.ticks[g.groupId];
  const m = childMain(a, g.groupId, p.preview?.mains ?? {}, p.data.current.label);
  const box = <Checkbox checked={!a.inactive && tick.members && !tick.excluded.includes(a.athleteId)} disabled={a.inactive || !tick.members} onChange={() => p.setTicks(toggleChild(p.ticks, g.groupId, a.athleteId))} label={childName(a)} />;
  return { m, box };
}

/** Desktop: the list under a row, with the "Sportiv | Grupa principală în <next>" header. */
function KidsRow({ g, p }: { g: StartGroup; p: StepProps }) {
  return (
    <tr className="grp-kids">
      <td colSpan={4}>
        <div className="grp-kid grp-kidh"><span>{NEW_SEASON_COPY.childHeader}</span><span>{NEW_SEASON_COPY.childMainHeader(p.data.target.label)}</span></div>
        {g.athletes.map((a) => {
          const { m, box } = childOf(g, a, p);
          return <div key={a.athleteId} className="grp-kid">{box}<span>{m.main}{m.note && <small className="spv-muted">{m.note}</small>}</span></div>;
        })}
      </td>
    </tr>
  );
}

function SeeLink({ g, open, setOpen }: { g: StartGroup; open: boolean; setOpen: (v: boolean) => void }) {
  if (g.members === 0) return null;
  return <button type="button" className="spv-link grp-see" onClick={() => setOpen(!open)}>{open ? NEW_SEASON_COPY.hide : NEW_SEASON_COPY.seeAthletes}</button>;
}

function GroupRows({ g, p }: { g: StartGroup; p: StepProps }) {
  const [open, setOpen] = React.useState(false);
  const tick = p.ticks[g.groupId];
  return (
    <>
      <tr>
        <td><span className="spv-name">{g.name}</span></td>
        <td>{inLine(g)}<SeeLink g={g} open={open} setOpen={setOpen} /></td>
        <td><Checkbox checked={tick.members} disabled={!membersEnabled(g)} onChange={() => p.setTicks(toggleGroup(p.ticks, g, 'members'))} aria-label={`${NEW_SEASON_COPY.colMembers} ${g.name}`} /></td>
        <td>
          <Checkbox checked={tick.program} disabled={!programEnabled(g)} onChange={() => p.setTicks(toggleGroup(p.ticks, g, 'program'))} aria-label={`${NEW_SEASON_COPY.colProgram} ${g.name}`} label={<span className="spv-muted">{programCell(g, p.data.target.label)}</span>} />
        </td>
      </tr>
      {open && <KidsRow g={g} p={p} />}
    </>
  );
}

function SectionTable({ s, p }: { s: StartSection; p: StepProps }) {
  const th = (k: TickKey, label: string) => <th scope="col"><HeaderBox section={s} ticks={p.ticks} setTicks={p.setTicks} k={k} label={label} /></th>;
  return (
    <section>
      <h3 className="ui-sec-title grp-sec">{s.label}</h3>
      <div className="ui-table-wrap grp-tbl">
        <table className="ui-table">
          <thead><tr><th scope="col">{NEW_SEASON_COPY.colGroup}</th><th scope="col">{NEW_SEASON_COPY.colIn(p.data.current.label)}</th>{th('members', NEW_SEASON_COPY.colMembers)}{th('program', NEW_SEASON_COPY.colProgram)}</tr></thead>
          <tbody>{s.groups.map((g) => <GroupRows key={g.groupId} g={g} p={p} />)}</tbody>
        </table>
      </div>
    </section>
  );
}

function GroupCard({ g, p }: { g: StartGroup; p: StepProps }) {
  const [open, setOpen] = React.useState(false);
  const tick = p.ticks[g.groupId];
  return (
    <div className="grp-card">
      <div className="spv-name">{g.name}</div>
      <div className="spv-muted">{phoneLine(g, p.data.current.label, p.data.target.label)}</div>
      <Checkbox checked={tick.members} disabled={!membersEnabled(g)} onChange={() => p.setTicks(toggleGroup(p.ticks, g, 'members'))} label={NEW_SEASON_COPY.colMembers} />
      <Checkbox checked={tick.program} disabled={!programEnabled(g)} onChange={() => p.setTicks(toggleGroup(p.ticks, g, 'program'))} label={NEW_SEASON_COPY.colProgram} />
      <SeeLink g={g} open={open} setOpen={setOpen} />
      {open && g.athletes.map((a) => {
        const { m, box } = childOf(g, a, p);
        return <div key={a.athleteId} className="grp-kidcard">{box}<span className="spv-muted">{childPhoneLine(m)}</span></div>;
      })}
    </div>
  );
}

function SectionCards({ s, p }: { s: StartSection; p: StepProps }) {
  return (
    <section>
      <h3 className="ui-sec-title grp-sec">{s.label}</h3>
      <div className="grp-bar">
        <HeaderBox section={s} ticks={p.ticks} setTicks={p.setTicks} k="members" label={NEW_SEASON_COPY.phoneAllMembers} />
        <HeaderBox section={s} ticks={p.ticks} setTicks={p.setTicks} k="program" label={NEW_SEASON_COPY.phoneAllProgram} />
      </div>
      {s.groups.map((g) => <GroupCard key={g.groupId} g={g} p={p} />)}
    </section>
  );
}

const Summary = ({ preview }: { preview: StartPreview }) => (
  <Notice tone="info">{preview.summaryParts.map((part, i) => (part.bold ? <b key={i}>{part.text}</b> : <React.Fragment key={i}>{part.text}</React.Fragment>))}</Notice>
);

/** Step 2 (10.2): one table per section with the header ticks in its column heads, the rule line and the summary; cards on phones. */
export function StepTwo(p: StepProps) {
  const phone = useIsPhone();
  return (
    <>
      <p>{NEW_SEASON_COPY.lead2(p.data.target.label, p.data.current.label)}</p>
      {p.data.sections.map((s) => (phone ? <SectionCards key={s.sectionId} s={s} p={p} /> : <SectionTable key={s.sectionId} s={s} p={p} />))}
      <p className="spv-muted">{NEW_SEASON_COPY.mainRule}</p>
      {p.preview && <Summary preview={p.preview} />}
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
