import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Board } from './Board';
import { createBoard, newCardDraft } from '@/state/defaults';
import { boardReducer } from '@/state/boardReducer';
import { parsePitch } from '@/music/pitch';
import type { CardItem } from '@/state/types';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));

function boardWithCards(): { state: ReturnType<typeof createBoard> } {
  const state = createBoard('saxophone');
  const cards: CardItem[] = [
    { ...newCardDraft(parsePitch('C5')), id: 'a' },
    { ...newCardDraft(parsePitch('D5')), id: 'b' },
  ];
  return { state: { ...state, items: cards } };
}

const noop = () => {};

describe('Board', () => {
  it('prevents the default browser action on drop', () => {
    const { state } = boardWithCards();
    const onReorder = vi.fn();
    const { container } = render(
      <Board state={state} onReorder={onReorder} onEdit={noop} onDuplicate={noop} onRemove={noop} onMeta={noop} onPlay={noop} />
    );
    const items = container.querySelectorAll('.wc-board-item');
    expect(items.length).toBe(2);
    const [first, second] = Array.from(items);

    fireEvent.dragStart(first, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { setData: vi.fn(), getData: vi.fn() } });
    const prevented = !second.dispatchEvent(dropEvent);

    expect(prevented).toBe(true);
    // Insertion-index semantics: the drop point on the second card resolves to
    // an index, not to that card's id.
    expect(onReorder).toHaveBeenCalledWith('a', 1);
  });

  it('clears the armed drag handle on a window-level pointerup even off the handle', () => {
    const { state } = boardWithCards();
    const { container } = render(
      <Board state={state} onReorder={noop} onEdit={noop} onDuplicate={noop} onRemove={noop} onMeta={noop} onPlay={noop} />
    );
    const handle = container.querySelector('.wc-card-drag-handle') as HTMLElement;
    const item = handle.closest('.wc-board-item') as HTMLElement;

    fireEvent.pointerDown(handle);
    expect(item.getAttribute('draggable')).toBe('true');

    // Released somewhere off the handle entirely — the handle's own
    // onPointerUp never fires, only the window-level listener does.
    fireEvent.pointerUp(window);
    expect(item.getAttribute('draggable')).toBe('false');
  });

  it('clears the armed drag handle on a window-level pointercancel', () => {
    const { state } = boardWithCards();
    const { container } = render(
      <Board state={state} onReorder={noop} onEdit={noop} onDuplicate={noop} onRemove={noop} onMeta={noop} onPlay={noop} />
    );
    const handle = container.querySelector('.wc-card-drag-handle') as HTMLElement;
    const item = handle.closest('.wc-board-item') as HTMLElement;

    fireEvent.pointerDown(handle);
    expect(item.getAttribute('draggable')).toBe('true');

    fireEvent.pointerCancel(window);
    expect(item.getAttribute('draggable')).toBe('false');
  });

  it('passes loadingPlay only to the card matching loading.key', () => {
    const { state } = boardWithCards();
    render(
      <Board state={state} onReorder={noop} onEdit={noop} onDuplicate={noop} onRemove={noop} onMeta={noop} onPlay={noop}
        loading={{ key: 'b', which: 'piano' }} />
    );
    // No spinner UI assertion here (that lives in WindCard); this just
    // exercises the prop-plumbing path without throwing.
  });

  it('marks the board-item wrapper data-export-hide when the card has no fingering, but not when it does', () => {
    const state = createBoard('flute');
    const cards: CardItem[] = [
      // flute has no fingering this low — unavailable
      { ...newCardDraft(parsePitch('C1')), id: 'unavailable' },
      // ordinary flute note — available
      { ...newCardDraft(parsePitch('C5')), id: 'available' },
    ];
    const { container } = render(
      <Board state={{ ...state, items: cards }} onReorder={noop} onEdit={noop} onDuplicate={noop} onRemove={noop} onMeta={noop} onPlay={noop} />
    );
    const items = container.querySelectorAll('.wc-board-item');
    expect(items.length).toBe(2);
    const [unavailableItem, availableItem] = Array.from(items);
    expect(unavailableItem.hasAttribute('data-export-hide')).toBe(true);
    expect(availableItem.hasAttribute('data-export-hide')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Drop indicator
// ---------------------------------------------------------------------------

const CARD_W = 100, CARD_H = 80, STEP = 120;

/** jsdom has no layout, so give the board items a synthetic one. */
function layout(items: Element[], axis: 'row' | 'column') {
  items.forEach((el, i) => {
    const left = axis === 'row' ? i * STEP : 0;
    const top = axis === 'row' ? 0 : i * STEP;
    const rect = { x: left, y: top, left, top, width: CARD_W, height: CARD_H, right: left + CARD_W, bottom: top + CARD_H };
    el.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
  });
}

function boardOf(ids: string[], columns: number | 'auto' = 'auto') {
  const base = createBoard('saxophone');
  const items: CardItem[] = ids.map((id, i) => ({ ...newCardDraft(parsePitch(['C5', 'D5', 'E5', 'F5'][i] ?? 'C5')), id }));
  return { ...base, items, meta: { ...base.meta, columns } };
}

/** Which item holds the indicator, and which variant it is. */
function indicator(container: HTMLElement) {
  const el = container.querySelector('.wc-drop-indicator');
  if (!el) return null;
  const items = Array.from(container.querySelectorAll('.wc-board-item'));
  return {
    el,
    itemIndex: items.findIndex((it) => it.contains(el)),
    axis: el.classList.contains('wc-drop-indicator-v') ? 'v' : 'h',
    side: el.classList.contains('-left-2.5') || el.classList.contains('-top-2.5') ? 'before' : 'after',
  };
}

/**
 * jsdom has no `DragEvent`, so `fireEvent.dragOver(el, { clientX })` silently
 * drops the pointer coordinates. Dispatch a real MouseEvent instead — same
 * interface React reads `clientX`/`clientY`/`relatedTarget` off.
 */
function fireDrag(el: Element, type: 'dragover' | 'drop' | 'dragleave', init: MouseEventInit = {}) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(ev, 'dataTransfer', { value: { setData: vi.fn(), getData: vi.fn(), effectAllowed: '' } });
  fireEvent(el, ev);
}

/** Centre-ish X of the left or right half of card `i` in a row layout. */
const halfX = (i: number, half: 'left' | 'right') => i * STEP + (half === 'left' ? CARD_W * 0.25 : CARD_W * 0.75);
const halfY = (i: number, half: 'top' | 'bottom') => i * STEP + (half === 'top' ? CARD_H * 0.25 : CARD_H * 0.75);

describe('Board drop indicator', () => {
  function setup(ids: string[], columns: number | 'auto' = 'auto') {
    const onReorder = vi.fn();
    const { container } = render(
      <Board state={boardOf(ids, columns)} onReorder={onReorder} onEdit={noop} onDuplicate={noop} onRemove={noop} onMeta={noop} onPlay={noop} />
    );
    const items = Array.from(container.querySelectorAll('.wc-board-item'));
    layout(items, columns === 1 ? 'column' : 'row');
    return { container, items, onReorder };
  }
  const startDrag = (el: Element) =>
    fireEvent.dragStart(el, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });

  it('shows no indicator until a drag starts', () => {
    const { container, items } = setup(['a', 'b', 'c']);
    fireDrag(items[2], 'dragover', { clientX: halfX(2, 'left'), clientY: 40 });
    expect(indicator(container)).toBeNull();
  });

  it('marks the gap before a card when the pointer is on its left half', () => {
    const { container, items } = setup(['a', 'b', 'c']);
    startDrag(items[0]);
    fireDrag(items[2], 'dragover', { clientX: halfX(2, 'left'), clientY: 40 });
    expect(indicator(container)).toMatchObject({ itemIndex: 2, axis: 'v', side: 'before' });
  });

  it('marks the gap after a card when the pointer is on its right half, and flips back across the midpoint', () => {
    const { container, items } = setup(['a', 'b', 'c']);
    startDrag(items[0]);

    // Right half of the LAST card -> index 3 == items.length -> trailing line
    // on the last item.
    fireDrag(items[2], 'dragover', { clientX: halfX(2, 'right'), clientY: 40 });
    expect(indicator(container)).toMatchObject({ itemIndex: 2, axis: 'v', side: 'after' });

    // Crossing back over the midpoint flips it to the leading side.
    fireDrag(items[2], 'dragover', { clientX: halfX(2, 'left'), clientY: 40 });
    expect(indicator(container)).toMatchObject({ itemIndex: 2, side: 'before' });
    expect(container.querySelectorAll('.wc-drop-indicator')).toHaveLength(1);
  });

  it('hides the indicator for a drop that would not move the card', () => {
    const { container, items } = setup(['a', 'b', 'c']);
    startDrag(items[0]);
    // Left half of b == index 1 == immediately after a: a no-op.
    fireDrag(items[1], 'dragover', { clientX: halfX(1, 'left'), clientY: 40 });
    expect(indicator(container)).toBeNull();
    // Left half of a itself == index 0 == a's own slot: also a no-op.
    fireDrag(items[0], 'dragover', { clientX: halfX(0, 'left'), clientY: 40 });
    expect(indicator(container)).toBeNull();
  });

  it('clears the indicator on dragEnd', () => {
    const { container, items } = setup(['a', 'b', 'c']);
    startDrag(items[0]);
    fireDrag(items[2], 'dragover', { clientX: halfX(2, 'left'), clientY: 40 });
    expect(indicator(container)).not.toBeNull();
    fireEvent.dragEnd(items[0]);
    expect(indicator(container)).toBeNull();
  });

  it('clears the indicator when the pointer leaves the grid entirely', () => {
    const { container, items } = setup(['a', 'b', 'c']);
    const grid = container.querySelector('.wc-board-grid') as HTMLElement;
    startDrag(items[0]);
    fireDrag(items[2], 'dragover', { clientX: halfX(2, 'left'), clientY: 40 });

    // Moving between children fires a dragleave whose relatedTarget is still
    // inside the grid — that must not clear the indicator.
    fireDrag(grid, 'dragleave', { relatedTarget: items[1] });
    expect(indicator(container)).not.toBeNull();

    fireDrag(grid, 'dragleave', { relatedTarget: document.body });
    expect(indicator(container)).toBeNull();
  });

  it('draws a horizontal line for a single-column board and a vertical one otherwise', () => {
    const one = setup(['a', 'b', 'c'], 1);
    startDrag(one.items[0]);
    fireDrag(one.items[2], 'dragover', { clientX: 50, clientY: halfY(2, 'top') });
    expect(indicator(one.container)).toMatchObject({ itemIndex: 2, axis: 'h', side: 'before' });

    for (const columns of ['auto', 2, 3, 4] as const) {
      const s = setup(['a', 'b', 'c'], columns);
      startDrag(s.items[0]);
      fireDrag(s.items[2], 'dragover', { clientX: halfX(2, 'left'), clientY: 40 });
      expect(indicator(s.container)).toMatchObject({ axis: 'v' });
    }
  });

  it('drops on the right half of a card land AFTER it in both drag directions', () => {
    // Forward: [a,b,c,d], drag a onto the right half of c.
    const fwd = setup(['a', 'b', 'c', 'd']);
    startDrag(fwd.items[0]);
    fireDrag(fwd.items[2], 'dragover', { clientX: halfX(2, 'right'), clientY: 40 });
    fireDrag(fwd.items[2], 'drop', { clientX: halfX(2, 'right'), clientY: 40 });
    expect(fwd.onReorder).toHaveBeenCalledWith('a', 3);

    // Backward: [a,b,c,d], drag d onto the right half of b.
    const back = setup(['a', 'b', 'c', 'd']);
    startDrag(back.items[3]);
    fireDrag(back.items[1], 'dragover', { clientX: halfX(1, 'right'), clientY: 40 });
    fireDrag(back.items[1], 'drop', { clientX: halfX(1, 'right'), clientY: 40 });
    expect(back.onReorder).toHaveBeenCalledWith('d', 2);

    // And the reducer turns both into "immediately after the target card".
    const ids = (s: ReturnType<typeof createBoard>) => s.items.map((i) => i.id);
    expect(ids(boardReducer(boardOf(['a', 'b', 'c', 'd']), { type: 'reorder', fromId: 'a', toIndex: 3 })))
      .toEqual(['b', 'c', 'a', 'd']);
    expect(ids(boardReducer(boardOf(['a', 'b', 'c', 'd']), { type: 'reorder', fromId: 'd', toIndex: 2 })))
      .toEqual(['a', 'b', 'd', 'c']);
  });

  it('keeps the indicator out of the exported image', () => {
    const { container, items } = setup(['a', 'b', 'c']);
    startDrag(items[0]);
    fireDrag(items[2], 'dragover', { clientX: halfX(2, 'left'), clientY: 40 });
    const el = container.querySelector('.wc-drop-indicator') as HTMLElement;
    // `exportBoardImage`'s html-to-image filter drops any node carrying this.
    expect(el.hasAttribute('data-export-hide')).toBe(true);
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});
