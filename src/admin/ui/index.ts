/**
 * Shared EduSport admin UI. Import from here:
 *   import { AdminPage, PageHeader, Button, SaveBar, useSaveState } from '../ui';
 * Reference page with every component: /admin/plugins/edusport-ui (not in the sidebar).
 */
export * from './tokens';
export { useAdminTheme, getAdminTheme, subscribeAdminTheme, startAdminThemeSync } from './useAdminTheme';
export { UI_CSS, ensureAdminUi } from './styles';
export { cx } from './cx';

export { AdminPage, type AdminPageProps } from './AdminPage';
export { Window, type WindowProps } from './Window';
export { PageHeader, type PageHeaderProps, type PageHeaderBack } from './PageHeader';
export { Section, type SectionProps } from './Section';
export { TwoColumn, type TwoColumnProps } from './TwoColumn';

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { StatusBadge, type StatusBadgeProps, type BadgeTone, type CustomBadgeColors } from './StatusBadge';
export { Chip, ChipList, type ChipProps } from './Chip';
export { RelationMultiSelect, type RelationMultiSelectProps, type RelationOption } from './RelationMultiSelect';
export { Switch, type SwitchProps } from './Switch';
export { Checkbox, type CheckboxProps } from './Checkbox';

export { Field, FieldRow, useFieldControl, type FieldProps, type FieldAria } from './Field';
export { Input, type InputProps } from './Input';
export { Textarea, type TextareaProps } from './Textarea';
export { Select, type SelectProps, type SelectOption } from './Select';
export { DateInput, type DateInputProps } from './DateInput';

export { SaveBar, type SaveBarProps } from './SaveBar';
export {
  SaveBarView,
  useSlideIn,
  useDiscardConfirm,
  type SaveBarViewProps,
  type SaveBarViewState,
  type SaveBarTone,
} from './SaveBarView';
export { useSaveState, SAVED_MS, type SaveState, type SaveStatus, type SaveBarState } from './useSaveState';
export { useUnsavedGuard, UnsavedGuard, releaseUnsavedGuards, type UnsavedGuardOptions } from './useUnsavedGuard';

export { Notice, type NoticeProps, type NoticeTone } from './Notice';
export {
  adminToast,
  useToast,
  toastAutosaved,
  ToastViewport,
  mountToastViewport,
  type ToastTone,
  type ToastOptions,
} from './Toast';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { StatTile, type StatTileProps } from './StatTile';
export { Spinner, Loading, type SpinnerProps } from './Spinner';
export { Modal, type ModalProps } from './Modal';
export { Drawer, DrawerSection, type DrawerProps, type DrawerSectionProps } from './Drawer';
export { Tabs, type TabsProps, type TabItem } from './Tabs';
export { Pager, pageList, type PagerProps } from './Pager';
export { DataTable, type DataTableProps, type DataColumn, type SortDir } from './DataTable';
export { ImagePicker, type ImagePickerProps, type PickedImage, type PickedMedia, type MediaAccept } from './ImagePicker';
export { InboxLayout, InboxRow, InboxReaderHead, groupByDay, type InboxLayoutProps, type InboxGroup, type InboxRowProps } from './InboxLayout';

export { Popover, type PopoverProps, type PopoverPlacement } from './Popover';
export { AddButton, type AddButtonProps } from './AddButton';
export { ExpandableRow, type ExpandableRowProps } from './ExpandableRow';
export {
  useDragReorder,
  moveItem,
  type UseDragReorderOptions,
  type DragReorder,
  type DragItemProps,
  type DragHandleProps,
} from './useDragReorder';
export { RepeatableList, type RepeatableListProps, type RepeatableRowApi } from './RepeatableList';
export { useObjectField, normalizeObject, type ObjectField } from './useObjectField';
export {
  ObjectFieldCard,
  type ObjectFieldCardProps,
  type ObjectFieldConfig,
  type ObjectFieldSection,
  type ObjectFieldType,
} from './ObjectFieldCard';
export { EditorCard, type EditorCardProps } from './EditorCard';
export { LinkOutCard, type LinkOutCardProps } from './LinkOutCard';
export { HelpTip, type HelpTipProps } from './HelpTip';
export { GalleryGrid, type GalleryGridProps, type GalleryImage } from './GalleryGrid';
export { DateRangeInput, type DateRangeInputProps, type DateRange } from './DateRangeInput';
export { TimeInput, parseTimeText, formatTime, type TimeInputProps, type HourMinute } from './TimeInput';
export { NumberInput, type NumberInputProps } from './NumberInput';
export { TagsInput, type TagsInputProps } from './TagsInput';
export { SearchableSelect, type SearchableSelectProps, type ComboOption } from './SearchableSelect';
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from './SegmentedControl';
