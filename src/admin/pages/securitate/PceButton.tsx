import * as React from 'react';
import { Button, type ButtonProps } from '../../ui/Button';
import { cx } from '../../ui/cx';

/**
 * The only Button of the Securitate page. Strapi's SaveBar tagger hides default save and publish buttons by their label unless they sit inside `.pce` or
 * `.ui-root`; this one carries `pce` itself, so no label can be tagged by accident.
 */
export const PceButton = React.forwardRef<HTMLButtonElement, ButtonProps>(function PceButton({ className, ...props }, ref) {
  return <Button ref={ref} {...props} className={cx('pce', className)} />;
});
