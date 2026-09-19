import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WindCard } from './WindCard';
import { createBoard, newCardDraft } from '@/state/defaults';
import { parsePitch } from '@/music/pitch';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));

const meta = { ...createBoard('saxophone').meta, horn: 'alto' };

describe('WindCard', () => {
  it('shows heading, subtitle, diagram and staff by default', () => {
    const { container } = render(<WindCard card={newCardDraft(parsePitch('C5'))} meta={meta} />);
    expect(screen.getByText('C5')).toBeInTheDocument();
    expect(screen.getByText('sounds E♭4')).toBeInTheDocument();
    expect(container.querySelector('.wc-fingering svg')).not.toBeNull();
    expect(screen.getByTestId('staff')).toBeInTheDocument();
  });
  it('display=fingering hides the staff; notation hides the diagram', () => {
    const { rerender, container } = render(<WindCard card={{ ...newCardDraft(parsePitch('C5')), display: 'fingering' }} meta={meta} />);
    expect(screen.queryByTestId('staff')).toBeNull();
    rerender(<WindCard card={{ ...newCardDraft(parsePitch('C5')), display: 'notation' }} meta={meta} />);
    expect(container.querySelector('.wc-fingering')).toBeNull();
  });
  it('scale sizes the diagram', () => {
    const { container } = render(<WindCard card={{ ...newCardDraft(parsePitch('C5')), scale: 2 }} meta={meta} />);
    expect((container.querySelector('.wc-fingering') as HTMLElement).style.width).toBe('240px');
  });
  it('fires play callbacks', async () => {
    const onPlay = vi.fn();
    render(<WindCard card={newCardDraft(parsePitch('C5'))} meta={meta} onPlay={onPlay} showPlay="always" />);
    await userEvent.click(screen.getByRole('button', { name: 'Play voice' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play piano' }));
    expect(onPlay.mock.calls).toEqual([['voice'], ['piano']]);
  });
  it('shows a placeholder when the note has no fingering', () => {
    render(<WindCard card={newCardDraft(parsePitch('C2'))} meta={meta} />);
    expect(screen.getByText('No fingering')).toBeInTheDocument();
  });
});
