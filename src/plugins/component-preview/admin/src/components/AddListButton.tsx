import * as React from 'react';
import { AddButton } from '../../../../../admin/ui';

// Full-width "+ label" button at the end of a list, used by every list section
// across the editors. Now the shared admin AddButton (src/admin/ui) on the
// --theme-* tokens instead of raw Strapi purple. These editors render inside
// content-manager fields, outside any page, so the wrapper carries `.ui-root`
// for the token variables and the .ui-add styles.
export function AddListButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="ui-root">
      <AddButton label={label} onClick={onClick} />
    </div>
  );
}
