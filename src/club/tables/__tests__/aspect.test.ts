import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASPECT_KEY, readAspect, writeAspect } from '../aspect';

const store = (impl: Partial<Storage>) => vi.stubGlobal('localStorage', impl);

describe('aspect', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to lista when nothing is stored or the value is unknown', () => {
    store({ getItem: () => null });
    expect(readAspect()).toBe('lista');
    store({ getItem: () => 'zzz' });
    expect(readAspect()).toBe('lista');
  });
  it('reads a stored foaie', () => {
    store({ getItem: (k: string) => (k === ASPECT_KEY ? 'foaie' : null) });
    expect(readAspect()).toBe('foaie');
  });
  it('returns lista when the storage throws, and a failed write does not throw', () => {
    store({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(readAspect()).toBe('lista');
    expect(() => writeAspect('foaie')).not.toThrow();
  });
  it('writes under the key', () => {
    const setItem = vi.fn();
    store({ setItem });
    writeAspect('foaie');
    expect(setItem).toHaveBeenCalledWith(ASPECT_KEY, 'foaie');
  });
});
