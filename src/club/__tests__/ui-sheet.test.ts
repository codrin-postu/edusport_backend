import { describe, expect, it } from 'vitest';
import { closeDistance, closesOnRelease, dragOffset } from '../ui-sheet';
// Pure (no DOM, no React): the stack ordering Modal, Drawer and the BottomSheet
// dropdown all key their own live isTopLayer checks on.
import { isTopLayer, pushLayer } from '../../admin/ui/layerStack';

describe('swipe down', () => {
  it('closeDistance is a quarter of the sheet height, at most 120px', () => {
    expect(closeDistance(400)).toBe(100);
    expect(closeDistance(800)).toBe(120);
  });

  it('a release far enough down closes; a short slow drag or an upward drag does not', () => {
    expect(closesOnRelease({ dy: 110, ms: 900, height: 400 })).toBe(true);
    expect(closesOnRelease({ dy: 60, ms: 900, height: 400 })).toBe(false);
    expect(closesOnRelease({ dy: -200, ms: 100, height: 400 })).toBe(false);
  });

  it('a quick flick closes, a tiny one does not', () => {
    expect(closesOnRelease({ dy: 40, ms: 60, height: 800 })).toBe(true);
    expect(closesOnRelease({ dy: 20, ms: 10, height: 800 })).toBe(false);
  });

  it('the sheet follows the finger downwards only', () => {
    expect(dragOffset(35)).toBe(35);
    expect(dragOffset(-20)).toBe(0);
  });
});

describe('layer stack ordering (layerStack.ts, shared with Modal and Drawer)', () => {
  // isTopLayer/pushLayer are plain stack logic (no DOM, no React): exercised
  // directly here, the same ordering Modal's and Drawer's own keydown
  // listeners already read live, and the BottomSheet dropdown's Popover
  // dismissable check below now reads live too (fix round 2).
  it('the most recently pushed token is top; a dialog opened from inside a popover outranks it; popping restores the one below', () => {
    const dropdown = Symbol('dropdown');
    const popDropdown = pushLayer(dropdown);
    expect(isTopLayer(dropdown)).toBe(true);

    const dialog = Symbol('dialog');
    const popDialog = pushLayer(dialog);
    expect(isTopLayer(dropdown)).toBe(false);
    expect(isTopLayer(dialog)).toBe(true);

    popDialog();
    expect(isTopLayer(dropdown)).toBe(true);
    popDropdown();
  });
});
