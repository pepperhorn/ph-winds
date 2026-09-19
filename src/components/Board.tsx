import { useState } from 'react';
import type { BoardMeta, BoardState, CardItem, TextField } from '@/state/types';
import { WindCard } from './WindCard';

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

export function Board({ state, onReorder, onEdit, onDuplicate, onRemove, onMeta, onPlay, selectedId }: {
  state: BoardState; selectedId?: string;
  onReorder(fromId: string, toId: string): void; onEdit(id: string): void; onDuplicate(id: string): void; onRemove(id: string): void;
  onMeta(p: Partial<BoardMeta>): void; onPlay(card: CardItem, which: 'voice' | 'piano'): void;
}) {
  const { meta, items } = state;
  const [drag, setDrag] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  // "safe" centering: when the row is narrower than its content (e.g. a 150%
  // horizontal card on a phone), fall back to start-alignment instead of
  // centering, which would overflow equally off both edges and strand the
  // left overflow somewhere a viewport can never scroll to (negative x).
  const grid = meta.columns === 'auto'
    ? 'flex flex-wrap [justify-content:safe_center] items-start'
    : `grid items-start [justify-items:safe_center] ${['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][meta.columns]}`;

  return (
    <section id="wc-board-export" className="wc-board rounded-3xl border border-hairline bg-surface p-8 shadow-glow">
      <ChromeInput f={meta.title} cls="wc-board-title" sizes={TITLE} weight="font-semibold" placeholder="Board title" onChange={(p) => onMeta({ title: { ...meta.title, ...p } })} />
      <ChromeInput f={meta.subtitle} cls="wc-board-subtitle mt-1 text-muted" sizes={SMALL} weight="font-normal" placeholder="Subtitle" onChange={(p) => onMeta({ subtitle: { ...meta.subtitle, ...p } })} />
      {items.length === 0
        ? <p className="wc-board-empty py-16 text-center text-sm text-muted">Pick a note on the keyboard, then &ldquo;Add to board&rdquo;.</p>
        : (
          <div className={`wc-board-grid mt-6 gap-5 overflow-x-auto ${grid}`}>
            {items.map((c) => (
              <div key={c.id} draggable={armed === c.id}
                onDragStart={(e) => { setDrag(c.id); e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDrag(null); setArmed(null); }}
                onDragOver={(e) => { if (drag) e.preventDefault(); }}
                onDrop={() => { if (drag && drag !== c.id) onReorder(drag, c.id); setDrag(null); }}
                className={`wc-board-item group/item relative min-w-0 max-w-full ${drag === c.id ? 'opacity-40' : ''} ${selectedId === c.id ? 'rounded-2xl ring-2 ring-accent' : ''}`}>
                <WindCard card={c} meta={meta} onPlay={(w) => onPlay(c, w)} />
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
            ))}
          </div>
        )}
      <div className="wc-board-footer-row mt-6"><ChromeInput f={meta.footer} cls="wc-board-footer text-muted" sizes={SMALL} weight="font-normal" placeholder="Footer" onChange={(p) => onMeta({ footer: { ...meta.footer, ...p } })} /></div>
    </section>
  );
}
