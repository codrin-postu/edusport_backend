import { describe, expect, it } from 'vitest';
import { radius, zIndex } from '../../admin/ui/tokens';
import { arrowOffset, isInsideNewerPopover, isNewestPopover } from '../ui-popover';

describe('arrowOffset', () => {
  it('points at the centre of the anchor', () => {
    expect(arrowOffset(100, 80, 100, 540)).toBe(40);
  });

  it('stays 14px away from the popover corners', () => {
    expect(arrowOffset(100, 10, 100, 540)).toBe(14);
    expect(arrowOffset(600, 80, 100, 540)).toBe(526);
  });
});

describe('nested popovers', () => {
  it('only the newest popover reacts to Escape', () => {
    expect(isNewestPopover([3, 7], 7)).toBe(true);
    expect(isNewestPopover([3, 7], 3)).toBe(false);
    expect(isNewestPopover([], 3)).toBe(false);
  });

  it('a pointer down in a newer popover does not close an older one', () => {
    expect(isInsideNewerPopover(3, 7)).toBe(true);
    expect(isInsideNewerPopover(7, 3)).toBe(false);
    expect(isInsideNewerPopover(3, null)).toBe(false);
  });
});

describe('tokens for the phase 3 layers', () => {
  it('the bottom sheet sits above a Drawer and under a Modal and a Popover', () => {
    expect(zIndex.drawer).toBeLessThan(zIndex.sheet);
    expect(zIndex.sheet).toBeLessThan(zIndex.modal);
    expect(zIndex.sheet).toBeLessThan(zIndex.popover);
  });

  it('dropdowns have 8px corners, the phone sheet rounded top corners, its grab handle square (polish 1)', () => {
    expect(radius.lg).toBe('8px');
    expect(radius.sheet).toBe('10px 10px 0 0');
    expect(radius).not.toHaveProperty('handle');
  });
});
