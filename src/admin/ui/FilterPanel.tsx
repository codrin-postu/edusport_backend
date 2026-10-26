import * as React from 'react';
import { cx } from './cx';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { Radio } from './Radio';
import { BottomSheet } from './BottomSheet';
import { useIsPhone } from './useMediaQuery';
import { IconChevronLeft, IconChevronRight } from './icons';
import {
  activeSections,
  matchOptions,
  needsSearch,
  sectionSummary,
  toggleChoice,
  type FilterChoice,
} from '../../club/ui-filters';

/** One filter section: its name, its options and what is chosen. */
export interface FilterSection {
  key: string;
  label: string;
  options: FilterChoice[];
  /** Chosen values; empty = "Toate". */
  selected: string[];
  /** One value at a time (radio rows). Default: several (checkbox rows). */
  single?: boolean;
  /** Text under the section name; default "Toate" or the chosen labels. */
  summary?: string;
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

/** The options of one section: 36px rows, checkbox or radio; a search box above 8 options. */
function FilterOptions({ section, onChange }: { section: FilterSection; onChange: OnChange }) {
  const [query, setQuery] = React.useState('');
  const name = React.useId();
  const pick = (value: string) => onChange(section.key, toggleChoice(section, value));
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
      {matchOptions(section.options, query).map((o) => {
        const on = section.selected.includes(o.value);
        return section.single ? (
          <Radio key={o.value} name={name} value={o.value} checked={on} onChange={() => pick(o.value)} label={o.label} />
        ) : (
          <Checkbox key={o.value} checked={on} onChange={() => pick(o.value)} label={o.label} />
        );
      })}
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
            <b>{s.label}</b>
            <span>{sectionSummary(s)}</span>
          </button>
        ))}
      </div>
      <div className="ui-fpane">{section && <FilterOptions key={section.key} section={section} onChange={onChange} />}</div>
    </div>
  );
}

/** Phone: the list of sections with their value and a chevron; a tap drills into the options. */
function PhoneBody({ sections, current, onPick, onChange }: BodyProps) {
  const section = sections.find((s) => s.key === current);
  if (section) {
    return (
      <>
        <b className="ui-fm-title">{section.label}</b>
        <FilterOptions key={section.key} section={section} onChange={onChange} />
      </>
    );
  }
  return (
    <div className="ui-fm-list">
      {sections.map((s) => (
        <button key={s.key} type="button" className="ui-fm-row" onClick={() => onPick(s.key)}>
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

/** Desktop: live total, "Șterge tot", "Gata". Phone: "Șterge tot" / "Șterge" (one section) and "Arată N ...". */
function FilterFooter({ phone, section, props, close }: FooterProps) {
  if (!phone) {
    return (
      <>
        <span className="ui-ff-total">{props.totalLabel}</span>
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
  const clear = () => (section ? props.onChange(section.key, []) : props.onClearAll());
  return (
    <>
      <Button variant="secondary" onClick={clear}>
        {section ? 'Șterge' : 'Șterge tot'}
      </Button>
      <Button className="ui-ff-show" onClick={close}>
        {props.showLabel}
      </Button>
    </>
  );
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
