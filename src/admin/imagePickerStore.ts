// Vanilla store that bridges the body-mounted Blocks toolbar buttons (which
// live OUTSIDE Strapi's StrapiAppProvider) with a small in-tree bridge
// component (rendered INSIDE the provider via VideoEmbedEditor). The
// toolbar publishes "open the image picker, call me back with the picks";
// the bridge picks up the request, renders Strapi's native MediaLibraryDialog,
// and invokes the callback when the user selects images.
//
// Callback identity matters here — the body-mount captures the live Slate
// editor reference in a closure on the onPick callback, so the bridge
// doesn't need to know anything about Slate.

export interface MediaPickerAsset {
  id?: number;
  name?: string;
  alternativeText?: string | null;
  caption?: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  formats?: unknown;
  hash?: string;
  ext?: string;
  mime?: string;
  size?: number;
  previewUrl?: string | null;
  provider?: string;
  provider_metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

interface State {
  isOpen: boolean;
  allowedTypes: ('images' | 'videos' | 'files' | 'audios')[];
  onPick: ((assets: MediaPickerAsset[]) => void) | null;
}

const initial: State = { isOpen: false, allowedTypes: ['images'], onPick: null };

let state: State = initial;
const listeners = new Set<() => void>();

export const imagePickerStore = {
  get(): State {
    return state;
  },
  /**
   * Open the picker. The callback fires exactly once with the picked assets.
   * Closes the picker automatically before invoking the callback.
   */
  open(
    onPick: (assets: MediaPickerAsset[]) => void,
    allowedTypes: State['allowedTypes'] = ['images'],
  ): void {
    state = { isOpen: true, allowedTypes, onPick };
    listeners.forEach((l) => l());
  },
  close(): void {
    state = { isOpen: false, allowedTypes: state.allowedTypes, onPick: null };
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
