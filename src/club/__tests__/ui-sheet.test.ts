import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDistance, closesOnRelease, dragOffset } from '../ui-sheet';
// Pure (no DOM, no React): the stack ordering Modal, Drawer and the BottomSheet
// dropdown all key their own live isTopLayer checks on.
import { isTopLayer, pushLayer } from '../../admin/ui/layerStack';

// The admin bundle has no test runner; these read its source.
const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

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

describe('BottomSheet wiring', () => {
  it('shares the layer stack and focus trap of Modal and Drawer', () => {
    const sheet = source('admin/ui/BottomSheet.tsx');
    expect(sheet).toContain('pushLayer(token)');
    expect(sheet).toContain('trapTab(e, boxRef.current)');
  });

  it('sits on the sheet layer, 85% high at most, full height as a variant, safe-area padded', () => {
    const css = source('admin/ui/styles.ts');
    expect(css).toContain('z-index:var(--ui-z-sheet');
    expect(css).toContain('max-height:85dvh');
    expect(css).toContain('.ui-sheet--full{height:100dvh;max-height:100dvh}');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('pads the last body block for the safe area too, when there is no footer', () => {
    const css = source('admin/ui/styles.ts');
    expect(css).toContain('.ui-sheet-b:last-child{padding-bottom:max(12px, env(safe-area-inset-bottom))}');
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

describe('desktop dropdown layer stack (component wiring)', () => {
  // The event-time check itself is pinned above as pure logic; these pin that
  // BottomSheet and Popover actually wire it in, by source-reading (the phase
  // 2B pattern: src/admin is excluded from Vitest, see Global Constraints).
  it('pushes a layer token while open, so a dialog opened from it becomes the newer layer', () => {
    const sheet = source('admin/ui/BottomSheet.tsx');
    expect(sheet).toContain('function useDropdownLayer(open: boolean, token: symbol): void {');
    expect(sheet).toContain('useDropdownLayer(p.open, token)');
  });

  it("passes Popover a live dismissable check, not a render-time one, so the top-layer read can't go stale", () => {
    const sheet = source('admin/ui/BottomSheet.tsx');
    expect(sheet).toContain('dismissable={() => isTopLayer(token)}');
    expect(sheet).toContain('onClose={() => p.dismissable && p.onClose()}');
  });

  it("Popover itself reads dismissable live, inside the keydown and pointerdown handlers, not baked in at render time", () => {
    const popover = source('admin/ui/Popover.tsx');
    expect(popover).toContain('dismissable?: () => boolean;');
    expect(popover).toContain('const dismissableRef = React.useRef(dismissable);');
    expect(popover).toContain('dismissableRef.current = dismissable;');
    expect(popover).toContain('if (dismissableRef.current && !dismissableRef.current()) return;');
  });
});
