/**
 * Shared EduSport admin UI. Import from here:
 *   import { AdminPage, PageHeader, Button, SaveBar, useSaveState } from '../ui';
 * Reference page with every component: /admin/plugins/edusport-ui (not in the sidebar).
 */
export * from './tokens';
export { useAdminTheme, getAdminTheme, subscribeAdminTheme, startAdminThemeSync } from './useAdminTheme';
export { ADM_CSS, ensureAdminUi } from './styles';
export { cx } from './cx';

export { AdminPage, type AdminPageProps } from './AdminPage';
export { Window, type WindowProps } from './Window';
export { PageHeader, type PageHeaderProps, type PageHeaderBack } from './PageHeader';
export { Section, type SectionProps } from './Section';
export { TwoColumn, type TwoColumnProps } from './TwoColumn';

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { StatusBadge, type StatusBadgeProps, type BadgeTone, type CustomBadgeColors } from './StatusBadge';
export { Chip, ChipList, type ChipProps } from './Chip';
export { Switch, type SwitchProps } from './Switch';
export { Checkbox, type CheckboxProps } from './Checkbox';

export { Field, FieldRow, useFieldControl, type FieldProps } from './Field';
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
export { useUnsavedGuard, UnsavedGuard, type UnsavedGuardOptions } from './useUnsavedGuard';

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
export { Spinner, Loading, type SpinnerProps } from './Spinner';
export { Modal, type ModalProps } from './Modal';
export { Tabs, type TabsProps, type TabItem } from './Tabs';
export { Pager, pageList, type PagerProps } from './Pager';
export { DataTable, type DataTableProps, type DataColumn, type SortDir } from './DataTable';
export { ImagePicker, type ImagePickerProps, type PickedImage } from './ImagePicker';
export { InboxLayout, type InboxLayoutProps, type InboxGroup } from './InboxLayout';
