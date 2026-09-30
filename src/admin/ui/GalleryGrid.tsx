import * as React from 'react';
import { cx } from './cx';
import { ensureAdminUi } from './styles';
import { ImagePicker, type PickedImage } from './ImagePicker';
import { useDragReorder, moveItem, type DragItemProps } from './useDragReorder';
import { IconClose, IconGrip, IconPlus } from './icons';

/**
 * Grid of square image tiles, picked through ImagePicker.
 *
 * Open list (SportivEdit, VoluntariatEdit galleries):
 *   <GalleryGrid images={imgs} onChange={setImgs} reorder max={12} />
 *   The last tile adds (multiple pick); each tile has an x to remove.
 *
 * Fixed slots (HomepageEdit's 3 photos):
 *   <GalleryGrid slots={3} images={[a, null, c]} onChange={setSlots} slotLabels={['Stânga', 'Centru', 'Dreapta']} />
 *   `images` has one entry per slot (null = empty); an empty slot picks one
 *   image, a filled tile replaces its image on click. Reorder swaps slots.
 *
 * Reorder: drag a tile by its grip, or focus the grip and use the arrow keys.
 */

export interface GalleryImage {
  id: number;
  url: string;
  name?: string | null;
  thumbnailUrl?: string;
  mime?: string;
}

interface BaseProps {
  /** Columns on wide screens. Default 4 (2 on phones). */
  columns?: number;
  reorder?: boolean;
  disabled?: boolean;
  /** Text on the add tile / empty slots. */
  addLabel?: string;
  className?: string;
  'aria-label'?: string;
}

export type GalleryGridProps =
  | (BaseProps & {
      slots?: undefined;
      images: GalleryImage[];
      onChange: (images: GalleryImage[]) => void;
      /** Hide the add tile past this many images. */
      max?: number;
      slotLabels?: undefined;
    })
  | (BaseProps & {
      slots: number;
      images: Array<GalleryImage | null>;
      onChange: (images: Array<GalleryImage | null>) => void;
      max?: undefined;
      /** Caption per slot, e.g. "Stânga". Default "Imaginea n". */
      slotLabels?: string[];
    });

const fromPicked = (p: PickedImage): GalleryImage => ({ id: p.id, url: p.url, name: p.name, thumbnailUrl: p.thumbnailUrl, mime: p.mime });

function Tile({
  img,
  label,
  onPick,
  onRemove,
  grip,
  disabled,
  itemProps,
}: {
  img: GalleryImage;
  label: string;
  onPick?: () => void;
  onRemove: () => void;
  grip?: React.ReactNode;
  disabled?: boolean;
  itemProps?: DragItemProps;
}) {
  const name = img.name || label;
  return (
    <li {...itemProps} className="ui-gal-tile" style={{ backgroundImage: `url(${img.thumbnailUrl ?? img.url})` }}>
      {onPick ? (
        <button type="button" className="ui-gal-hit" aria-label={`Schimbă ${label}: ${name}`} disabled={disabled} onClick={onPick} />
      ) : (
        <span className="ui-sr">{name}</span>
      )}
      {grip}
      <button type="button" className="ui-gal-x" aria-label={`Elimină ${name}`} title="Elimină" disabled={disabled} onClick={onRemove}>
        <IconClose size={12} />
      </button>
      <span className="ui-gal-cap" aria-hidden="true">
        {label}
      </span>
    </li>
  );
}

export function GalleryGrid(props: GalleryGridProps) {
  const { columns = 4, reorder = false, disabled = false, className } = props;
  React.useInsertionEffect(() => ensureAdminUi(), []);
  const slotMode = props.slots !== undefined;
  const [picking, setPicking] = React.useState<null | { slot: number | null }>(null);
  const imagesRef = React.useRef(props.images);
  imagesRef.current = props.images;

  const count = slotMode ? (props.slots as number) : props.images.length;
  const list: Array<GalleryImage | null> = slotMode
    ? Array.from({ length: count }, (_, i) => (props.images as Array<GalleryImage | null>)[i] ?? null)
    : props.images;

  const emit = (next: Array<GalleryImage | null>) => {
    if (slotMode) (props.onChange as (v: Array<GalleryImage | null>) => void)(next);
    else (props.onChange as (v: GalleryImage[]) => void)(next.filter((x): x is GalleryImage => x !== null));
  };

  const current = (): Array<GalleryImage | null> =>
    slotMode ? Array.from({ length: count }, (_, i) => (imagesRef.current as Array<GalleryImage | null>)[i] ?? null) : imagesRef.current;

  const drag = useDragReorder({
    count,
    axis: 'grid',
    swap: slotMode,
    disabled: disabled || !reorder,
    onMove: (from, to) => {
      const cur = current();
      if (slotMode) {
        // Slots keep their places: swap the two.
        const next = cur.slice();
        [next[from], next[to]] = [next[to], next[from]];
        emit(next);
      } else emit(moveItem(cur, from, to));
    },
  });

  const labelOf = (i: number) => (slotMode ? (props.slotLabels?.[i] ?? `Imaginea ${i + 1}`) : `Imaginea ${i + 1}`);
  const full = !slotMode && props.max !== undefined && props.images.length >= props.max;
  const addLabel = props.addLabel ?? (slotMode ? 'Alege imaginea' : 'Adaugă imagini');

  const remove = (i: number) => {
    const cur = current();
    if (slotMode) emit(cur.map((x, j) => (j === i ? null : x)));
    else emit(cur.filter((_, j) => j !== i));
  };

  // Stable keys (id, then id~2 for a repeated image) so a moved tile keeps its DOM node.
  const seen = new Map<number, number>();
  const keyOf = (img: GalleryImage) => {
    const n = (seen.get(img.id) ?? 0) + 1;
    seen.set(img.id, n);
    return n === 1 ? String(img.id) : `${img.id}~${n}`;
  };

  const style = { '--ui-gal-cols': String(columns) } as React.CSSProperties;

  return (
    <div className={cx('ui-root', 'ui-gal-wrap', className)}>
      <ul className="ui-gal" style={style} aria-label={props['aria-label'] ?? 'Galerie'}>
        {list.map((img, i) => {
          const grip =
            reorder && img ? (
              <button type="button" className="ui-gal-grip" aria-label={`Mută ${labelOf(i)}`} disabled={disabled} {...drag.handleProps(i)}>
                <IconGrip size={12} />
              </button>
            ) : null;
          const itemProps = reorder ? drag.itemProps(i) : undefined;
          if (!img) {
            return (
              <li key={`slot-${i}`} {...itemProps} className="ui-gal-tile ui-gal-tile--empty">
                <button type="button" className="ui-gal-add" disabled={disabled} onClick={() => setPicking({ slot: i })} aria-label={`${addLabel}: ${labelOf(i)}`}>
                  <IconPlus />
                  <span>{addLabel}</span>
                </button>
                <span className="ui-gal-cap" aria-hidden="true">
                  {labelOf(i)}
                </span>
              </li>
            );
          }
          return (
            <Tile
              key={slotMode ? `slot-${i}` : keyOf(img)}
              img={img}
              label={labelOf(i)}
              grip={grip}
              disabled={disabled}
              itemProps={itemProps}
              onPick={slotMode ? () => setPicking({ slot: i }) : undefined}
              onRemove={() => remove(i)}
            />
          );
        })}
        {!slotMode && !full && (
          <li className="ui-gal-tile ui-gal-tile--empty">
            <button type="button" className="ui-gal-add" disabled={disabled} onClick={() => setPicking({ slot: null })}>
              <IconPlus />
              <span>{addLabel}</span>
            </button>
          </li>
        )}
      </ul>
      {reorder && drag.live}
      {picking?.slot === null ? (
        <ImagePicker
          open
          multiple
          onClose={() => setPicking(null)}
          onPick={(picked) => {
            const cur = current() as GalleryImage[];
            const have = new Set(cur.map((c) => c.id));
            let add = picked.map(fromPicked).filter((p) => !have.has(p.id));
            if (!slotMode && props.max !== undefined) add = add.slice(0, Math.max(0, props.max - cur.length));
            emit([...cur, ...add]);
            setPicking(null);
          }}
        />
      ) : (
        <ImagePicker
          open={picking !== null}
          onClose={() => setPicking(null)}
          onPick={(p) => {
            const slot = picking?.slot ?? 0;
            emit(current().map((x, j) => (j === slot ? fromPicked(p) : x)));
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

export default GalleryGrid;
