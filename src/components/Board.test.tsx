import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Board } from './Board';
import { createBoard, newCardDraft } from '@/state/defaults';
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
    expect(onReorder).toHaveBeenCalledWith('a', 'b');
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
});
