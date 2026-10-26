import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { closeDistance, closesOnRelease, dragOffset } from '../ui-sheet';

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

describe('desktop dropdown layer stack', () => {
  // isTopLayer/pushLayer live in src/admin/ui/layerStack.ts (shared with Modal
  // and Drawer since Task 1), not in src/club: it is DOM-adjacent admin-bundle
  // wiring, not pure swipe/close logic, so it is pinned here by source-reading
  // the component instead of a pure unit test.
  it('pushes a layer token while open, so a dialog opened from it becomes the newer layer', () => {
    const sheet = source('admin/ui/BottomSheet.tsx');
    expect(sheet).toContain('function useDropdownLayer(open: boolean, token: symbol): void {');
    expect(sheet).toContain('useDropdownLayer(p.open, token)');
  });

  it('passes onClose to Popover only while it is the top layer, still gated by dismissable', () => {
    const sheet = source('admin/ui/BottomSheet.tsx');
    expect(sheet).toContain('const onClose = isTopLayer(token) ? () => p.dismissable && p.onClose() : undefined;');
  });
});
