import { useEffect, useMemo, useState } from 'react';
import type { BoardMeta, BoardState, CardItem, TextField } from '@/state/types';
import { WindCard } from './WindCard';
import { hasFingering } from '@/music/instruments';
import { toMidi } from '@/music/pitch';

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
const TITLE = { S: 'text-xl', M: 'text-2xl', L: 'text-3xl' } as const;
const SMALL = { S: 'text-sm', M: 'text-base', L: 'text-lg' } as const;

function ChromeInput({ f, onChange, cls, sizes, placeholder, weight }:
  { f: TextField; onChange(p: Partial<TextField>): void; cls: string; sizes: Record<'S' | 'M' | 'L', string>; placeholder: string; weight: string }) {
  if (!f.show) return null;
  return (
    <input value={f.text} placeholder={placeholder} onChange={(e) => onChange({ text: e.target.value })} aria-label={placeholder}
      className={`${cls} w-full bg-transparent ${sizes[f.size]} ${ALIGN[f.align]} ${weight} placeholder:text-muted/50 focus:outline-none`} />
  );
}

/**
 * The glow line drawn in the gutter between two cards during a drag, marking
 * the gap the dragged card will land in. Decorative (`aria-hidden`) and
 * excluded from PNG/PDF export by `data-export-hide`, which `exportBoardImage`
 * uses as its html-to-image node filter.
 */
function DropIndicator({ stacked, side }: { stacked: boolean; side: 'before' | 'after' }) {
  // `.wc-board-item` is `relative`; the grid gap is `gap-5` (20px), so 10px
  // out from the card edge sits the bar in the middle of the gutter.
  const place = stacked
    ? `wc-drop-indicator-h inset-x-0 h-[3px] ${side === 'before' ? '-top-2.5' : '-bottom-2.5'}`
    : `wc-drop-indicator-v inset-y-0 w-[3px] ${side === 'before' ? '-left-2.5' : '-right-2.5'}`;
  return (
    <div aria-hidden="true" data-export-hide
      className={`wc-drop-indicator ${place} pointer-events-none absolute z-10 rounded-full bg-accent`}
      style={{ boxShadow: '0 0 8px rgb(109 93 252 / .8)' }} />
  );
}

export function Board({ state, onReorder, onEdit, onDuplicate, onRemove, onMeta, onPlay, selectedId, loading }: {
  state: BoardState; selectedId?: string;
  onReorder(fromId: string, toIndex: number): void; onEdit(id: string): void; onDuplicate(id: string): void; onRemove(id: string): void;
  onMeta(p: Partial<BoardMeta>): void; onPlay(card: CardItem, which: 'voice' | 'piano'): void;
  loading?: { key: string; which: 'voice' | 'piano' } | null;
}) {
  const { meta, items } = state;
  const [drag, setDrag] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  // Insertion index (0..items.length) the dragged card would land at — i.e.
  // which gap between cards the glow line is drawn in. `null` = no indicator.
  const [dropAt, setDropAt] = useState<number | null>(null);

  // Safety net: if the pointer is released off the drag handle (no
  // setPointerCapture), the handle's own onPointerUp never fires and
  // `armed` would otherwise leak `true`, leaving that card spuriously
  // draggable. Clear it on any window-level pointerup/pointercancel.
  useEffect(() => {
    const clear = () => setArmed(null);
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, []);
  // "safe" centering: when the row is narrower than its content (e.g. a 150%
  // horizontal card on a phone), fall back to start-alignment instead of
  // centering, which would overflow equally off both edges and strand the
  // left overflow somewhere a viewport can never scroll to (negative x).
  //
  // The item itself must never be allowed to shrink below its content size
  // (`shrink-0`, no `min-w-0`/`max-w-full`): a shrunk item forces its own
  // inner `.wc-card-body` (plain `justify-center`, fixed-px diagram/staff
  // widths) narrower than its content, which then clips visually on both
  // sides since the card's border/background only extend to the shrunk
  // width. Oversized cards are meant to overflow and be scrolled to, not
  // squeezed.
  const grid = meta.columns === 'auto'
    ? 'flex flex-wrap [justify-content:safe_center] items-start'
    : `grid items-start [justify-items:safe_center] ${['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][meta.columns]}`;

  // Memoised per-card "does this pitch have a fingering on the current
  // instrument/horn" predicate: only recompute when the cards or the
  // instrument/horn actually change, not on every Board re-render (drag
  // state, hover, etc).
  // A one-column board stacks its cards, so the insertion gap runs across the
  // board and the indicator is a horizontal bar measured on Y. Every other
  // setting ('auto' flex-wrap, or 2-4 columns) puts cards side by side in a
  // row, so the gap is vertical and measured on X. Derived from the layout
  // setting rather than measured off neighbours, which would be wrong for the
  // first/last card in a row anyway.
  const stacked = meta.columns === 1;
  // Which gap the pointer is nearest: before card `i`, or after it.
  const insertAt = (e: React.DragEvent<HTMLElement>, i: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    const past = stacked ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    return i + (past ? 1 : 0);
  };
  const dragIndex = drag === null ? -1 : items.findIndex((c) => c.id === drag);
  // Landing in the gap on either side of the dragged card's own slot is a
  // no-op, so don't promise a move that won't happen.
  const indicatorAt = drag !== null && dropAt !== null && dropAt !== dragIndex && dropAt !== dragIndex + 1
    ? dropAt
    : null;

  const unavailableById = useMemo(
    () => new Map(items.map((c) => [c.id, !hasFingering(meta.instrument, meta.horn, toMidi(c.pitch))])),
    [items, meta.instrument, meta.horn],
  );

  return (
    <section id="wc-board-export" className="wc-board rounded-3xl border border-hairline bg-surface p-8 shadow-glow">
      <ChromeInput f={meta.title} cls="wc-board-title" sizes={TITLE} weight="font-semibold" placeholder="Board title" onChange={(p) => onMeta({ title: { ...meta.title, ...p } })} />
      <ChromeInput f={meta.subtitle} cls="wc-board-subtitle mt-1 text-muted" sizes={SMALL} weight="font-normal" placeholder="Subtitle" onChange={(p) => onMeta({ subtitle: { ...meta.subtitle, ...p } })} />
      {items.length === 0
        ? <p className="wc-board-empty py-16 text-center text-sm text-muted">Pick a note on the keyboard, then &ldquo;Add to board&rdquo;.</p>
        : (
          <div className={`wc-board-grid mt-6 gap-5 overflow-x-auto ${grid}`}
            onDragLeave={(e) => {
              // Moving between child elements fires a spurious dragleave on the
              // grid; only clear when the pointer really left the grid.
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null);
            }}>
            {items.map((c, i) => {
              const loadingPlay = loading?.key === c.id ? loading.which : undefined;
              const unavailable = unavailableById.get(c.id) ?? true;
              return (
              <div key={c.id} draggable={armed === c.id} data-export-hide={unavailable || undefined}
                onDragStart={(e) => { setDrag(c.id); e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDrag(null); setArmed(null); setDropAt(null); }}
                onDragOver={(e) => { if (drag) { e.preventDefault(); setDropAt(insertAt(e, i)); } }}
                onDrop={(e) => {
                  e.preventDefault();
                  // Prefer the index the indicator is showing; fall back to the
                  // drop point itself if no dragover ever landed on this item.
                  if (drag) onReorder(drag, dropAt ?? insertAt(e, i));
                  setDrag(null); setDropAt(null);
                }}
                className={`wc-board-item group/item relative shrink-0 ${drag === c.id ? 'opacity-40' : ''} ${selectedId === c.id ? 'rounded-2xl ring-2 ring-accent' : ''}`}>
                {indicatorAt === i && <DropIndicator stacked={stacked} side="before" />}
                {indicatorAt === items.length && i === items.length - 1 && <DropIndicator stacked={stacked} side="after" />}
                <WindCard card={c} meta={meta} onPlay={(w) => onPlay(c, w)} loadingPlay={loadingPlay} />
                <div data-export-hide className="wc-card-toolbar absolute -top-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-hairline bg-surface px-1.5 py-1 opacity-0 shadow-glow transition group-hover/item:opacity-100 group-focus-within/item:opacity-100">
                  {/* A <button> ancestor swallows the mousedown Firefox needs to arm a native drag
                      gesture, so the handle is a role="button" span, not a real button. */}
                  <span role="button" tabIndex={0} aria-label="Drag to reorder" onPointerDown={() => setArmed(c.id)} onPointerUp={() => setArmed(null)}
                    className="wc-card-drag-handle btn-drag cursor-grab px-1.5 text-muted">⠿</span>
                  <button type="button" aria-label="Edit card" onClick={() => onEdit(c.id)} className="wc-card-edit-btn btn-edit px-1.5 text-xs">Edit</button>
                  <button type="button" aria-label="Duplicate card" onClick={() => onDuplicate(c.id)} className="wc-card-duplicate-btn btn-duplicate px-1.5 text-xs">Copy</button>
                  <button type="button" aria-label="Delete card" onClick={() => onRemove(c.id)} className="wc-card-delete-btn btn-delete px-1.5 text-xs text-red-500">✕</button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      <div className="wc-board-footer-row mt-6"><ChromeInput f={meta.footer} cls="wc-board-footer text-muted" sizes={SMALL} weight="font-normal" placeholder="Footer" onChange={(p) => onMeta({ footer: { ...meta.footer, ...p } })} /></div>
    </section>
  );
}
