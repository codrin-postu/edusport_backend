import * as React from 'react';
import { cx } from './cx';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { RadioGroup } from './Radio';
import { BottomSheet } from './BottomSheet';
import { useIsPhone } from './useMediaQuery';
import { IconChevronLeft, IconChevronRight } from './icons';
import {
  activeSections,
  CLEAR_VALUE,
  matchOptions,
  needsSearch,
  sectionSummary,
  singleRows,
  singleSelection,
  toggleChoice,
  type FilterChoice,
} from '../../club/ui-filters';

/** One filter section: its name, its options and what is chosen. */
export interface FilterSection {
  key: string;
  label: string;
  options: FilterChoice[];
  /** Chosen values, each one present in `options`; empty = "Toate". */
  selected: string[];
  /** One value at a time (radio rows). Default: several (checkbox rows). */
  single?: boolean;
  /** Text under the section name; default the `allLabel` or the chosen labels. */
  summary?: string;
  /** Text for nothing chosen; in a single section also its first row, which clears it. Default "Toate" (e.g. "Oricând"); null = no such row (e.g. sort). */
  allLabel?: string | null;
}

export interface FilterPanelProps {
  sections: FilterSection[];
  /** A section's new selection; filters apply at once, the list stays visible. */
  onChange: (key: string, selected: string[]) => void;
  /** "Șterge tot": clear every section. */
  onClearAll: () => void;
  /** Live total in the desktop footer, e.g. "218 sportivi". */
  totalLabel: string;
  /** Phone footer button, e.g. "Arată 218 sportivi" / "Arată 1 sportiv". */
  showLabel: string;
  /** Button text. Default "Filtre". */
  buttonLabel?: string;
  className?: string;
}

const FILTERS = 'Filtre';
/** Search box placeholder in a long section (plan 3-1, Needs decision 4). */
const SEARCH_PLACEHOLDER = 'Caută...';
/** Width of the desktop dropdown (filters-v3). */
const DROPDOWN_WIDTH = 540;

type OnChange = FilterPanelProps['onChange'];

interface OptionsProps {
  section: FilterSection;
  /** Id of the section name: labels the group of options. */
  labelId: string;
  onChange: OnChange;
}

/** The option rows of one section, a group named by the section: radios (first row clears) or checkboxes. */
function OptionRows({ section, labelId, onChange, shown }: OptionsProps & { shown: FilterChoice[] }) {
  if (section.single) {
    return (
      <RadioGroup
        direction="column"
        aria-labelledby={labelId}
        value={section.selected[0] ?? CLEAR_VALUE}
        options={singleRows(section, shown)}
        onChange={(v) => onChange(section.key, singleSelection(v))}
      />
    );
  }
  const pick = (value: string) => onChange(section.key, toggleChoice(section, value));
  return (
    <div role="group" aria-labelledby={labelId}>
      {shown.map((o) => (
        <Checkbox key={o.value} checked={section.selected.includes(o.value)} onChange={() => pick(o.value)} label={o.label} />
      ))}
    </div>
  );
}

/** The options of one section: 36px rows, checkbox or radio; a search box above 8 options. */
function FilterOptions(props: OptionsProps) {
  const { section } = props;
  const [query, setQuery] = React.useState('');
  return (
    <div className="ui-fopts">
      {needsSearch(section.options.length) && (
        <Input
          className="ui-fopts-search"
          value={query}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label={section.label}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <OptionRows {...props} shown={matchOptions(section.options, query)} />
    </div>
  );
}

interface BodyProps {
  sections: FilterSection[];
  current: string | null;
  onPick: (key: string | null) => void;
  onChange: OnChange;
}

/** Desktop: sections on the left with their value, the open section's options on the right. */
function DesktopBody({ sections, current, onPick, onChange }: BodyProps) {
  const section = sections.find((s) => s.key === current) ?? sections[0];
  const base = React.useId();
  return (
    <div className="ui-fdesk">
      <div className="ui-fnav">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            className="ui-fnav-item"
            aria-current={s.key === section?.key || undefined}
            data-set={s.selected.length > 0 || undefined}
            onClick={() => onPick(s.key)}
          >
            <b id={`${base}-${s.key}`}>{s.label}</b>
            <span>{sectionSummary(s)}</span>
          </button>
        ))}
      </div>
      <div className="ui-fpane">
        {section && <FilterOptions key={section.key} section={section} labelId={`${base}-${section.key}`} onChange={onChange} />}
      </div>
    </div>
  );
}

/** Phone drill-in focus: the section title on entering a section, the row just left on going back. */
function useDrillFocus(key: string | null) {
  const titleRef = React.useRef<HTMLElement | null>(null);
  const rows = React.useRef(new Map<string, HTMLButtonElement>());
  const left = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (key !== null) {
      left.current = key;
      titleRef.current?.focus();
      return;
    }
    if (left.current !== null) rows.current.get(left.current)?.focus();
    left.current = null;
  }, [key]);
  const rowRef = (k: string) => (el: HTMLButtonElement | null) => {
    if (el) rows.current.set(k, el);
    else rows.current.delete(k);
  };
  return { titleRef, rowRef };
}

/** Phone: the list of sections with their value and a chevron; a tap drills into the options. */
function PhoneBody({ sections, current, onPick, onChange }: BodyProps) {
  const section = sections.find((s) => s.key === current);
  const base = React.useId();
  const { titleRef, rowRef } = useDrillFocus(section?.key ?? null);
  if (section) {
    return (
      <>
        <b className="ui-fm-title" id={`${base}-${section.key}`} tabIndex={-1} ref={titleRef}>
          {section.label}
        </b>
        <FilterOptions key={section.key} section={section} labelId={`${base}-${section.key}`} onChange={onChange} />
      </>
    );
  }
  return (
    <div className="ui-fm-list">
      {sections.map((s) => (
        <button key={s.key} ref={rowRef(s.key)} type="button" className="ui-fm-row" onClick={() => onPick(s.key)}>
          <span>
            <b>{s.label}</b>
            <small data-set={s.selected.length > 0 || undefined}>{sectionSummary(s)}</small>
          </span>
          <IconChevronRight />
        </button>
      ))}
    </div>
  );
}

/** "‹ Filtre": back from a section to the list of sections (phone). */
function BackToList({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ui-fback" onClick={onClick}>
      <IconChevronLeft size={12} />
      {label}
    </button>
  );
}

const FilterTrigger = React.forwardRef<HTMLButtonElement, { label: string; count: number; open: boolean; onClick: () => void }>(
  function FilterTrigger({ label, count, open, onClick }, ref) {
    return (
      <Button ref={ref} variant="secondary" className="ui-fbtn" aria-haspopup="dialog" aria-expanded={open} onClick={onClick}>
        {label}
        {count > 0 && <span className="ui-fbtn-n">{count}</span>}
      </Button>
    );
  },
);

interface FooterProps {
  phone: boolean;
  section: FilterSection | null;
  props: FilterPanelProps;
  close: () => void;
}

/** Phone: "Șterge tot" / "Șterge" (one section) and "Arată N ..."; the total is announced, not shown. */
function PhoneFooter({ section, props, close }: Omit<FooterProps, 'phone'>) {
  const clear = () => (section ? props.onChange(section.key, []) : props.onClearAll());
  return (
    <>
      <span className="ui-sr" role="status" aria-live="polite">
        {props.totalLabel}
      </span>
      <Button variant="secondary" onClick={clear}>
        {section ? 'Șterge' : 'Șterge tot'}
      </Button>
      <Button className="ui-ff-show" onClick={close}>
        {props.showLabel}
      </Button>
    </>
  );
}

/** Desktop: live total (announced), "Șterge tot", "Gata". Phone: PhoneFooter. */
function FilterFooter({ phone, section, props, close }: FooterProps) {
  if (!phone) {
    return (
      <>
        <span className="ui-ff-total" role="status" aria-live="polite">
          {props.totalLabel}
        </span>
        <span className="ui-ff-grow" />
        <Button variant="ghost" size="sm" onClick={props.onClearAll}>
          Șterge tot
        </Button>
        <Button size="sm" onClick={close}>
          Gata
        </Button>
      </>
    );
  }
  return <PhoneFooter section={section} props={props} close={close} />;
}

/**
 * Filters, filters-v3 layout (DECISIONS 2026-10-06 filters-v3): a "Filtre"
 * button (with the number of active sections) opening a BottomSheet. Desktop:
 * dropdown, sections left with their value (chosen in blue, otherwise
 * "Toate"), options right in 36px rows, live total, "Șterge tot", "Gata".
 * Phone: the sections with their value and a chevron, a tap drills into the
 * options ("‹ Filtre" back), footer "Arată N ...". Choices apply at once.
 */
export function FilterPanel(props: FilterPanelProps) {
  const { sections, onChange, buttonLabel = FILTERS, className } = props;
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);
  const phone = useIsPhone();
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setCurrent(null);
  };
  const section = phone ? (sections.find((s) => s.key === current) ?? null) : null;
  const Body = phone ? PhoneBody : DesktopBody;
  return (
    <span className={cx('ui-filters', className)}>
      <FilterTrigger ref={anchorRef} label={buttonLabel} count={activeSections(sections)} open={open} onClick={() => (open ? close() : setOpen(true))} />
      <BottomSheet
        open={open}
        onClose={close}
        title={section ? <BackToList label={buttonLabel} onClick={() => setCurrent(null)} /> : buttonLabel}
        ariaLabel={buttonLabel}
        anchorRef={anchorRef}
        dropdownWidth={DROPDOWN_WIDTH}
        footer={<FilterFooter phone={phone} section={section} props={props} close={close} />}
      >
        <Body sections={sections} current={current} onPick={setCurrent} onChange={onChange} />
      </BottomSheet>
    </span>
  );
}

export default FilterPanel;
