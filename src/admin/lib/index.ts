/**
 * Data helpers for the custom pages (src/admin/pages). Import from here:
 *   import { useSingleType, usePageForm } from '../lib';
 * API and page pattern: docs/admin-ui/CUSTOM-PAGES.md, "How to build a page".
 */
export {
  useSingleType,
  useCollectionEntry,
  type DocumentOptions,
  type DocumentState,
  type SingleTypeState,
  type CollectionEntryState,
} from './useSingleType';
export { useCollection, type CollectionOptions, type CollectionState, type Row } from './useCollection';
export { usePageForm, type PageForm } from './usePageForm';
export { serialize, changedFields, deepEqual, loadSchemas, type ModelSchema, type Attribute, type SchemaSet } from './contentApi';
export { startLegacyRedirects, legacyTarget } from './legacyRedirects';
