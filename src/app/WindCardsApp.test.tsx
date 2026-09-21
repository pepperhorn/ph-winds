import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WindCardsApp from './WindCardsApp';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));
vi.mock('@/notation/verovio', () => ({
  prefetchVerovioWhenIdle: () => () => {},
  pendingRenders: () => Promise.resolve(),
  musicFontToVerovioFont: (font: string) => (font === 'petaluma' ? 'Petaluma' : 'Bravura'),
}));
vi.mock('@/audio/playback', () => ({ playNote: vi.fn(() => Promise.resolve()), releaseVoicesExcept: vi.fn(), isVoiceLoaded: () => true }));

describe('WindCardsApp', () => {
  beforeEach(() => localStorage.clear());
  it('picks a note on the piano, adds a card, persists it', async () => {
    const { unmount } = render(<WindCardsApp />);
    await userEvent.click(screen.getByRole('button', { name: 'C5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to board' }));
    const board = document.getElementById('wc-board-export')!;
    // The default card heading is the register-aware name for the written pitch.
    expect(within(board).getByText('Middle C')).toBeInTheDocument();
    unmount();
    render(<WindCardsApp />);
    expect(within(document.getElementById('wc-board-export')!).getByText('Middle C')).toBeInTheDocument();
  });
  it('concert mode maps key clicks to written pitch', async () => {
    render(<WindCardsApp />);   // default: alto sax
    await userEvent.click(screen.getByRole('radio', { name: 'Concert Pitch (Piano)' }));
    await userEvent.click(screen.getByRole('button', { name: 'E♭4' }));
    expect(within(document.querySelector('.wc-builder-preview')!).getByText('Middle C')).toBeInTheDocument();
  });
  it('switching instrument remaps the board rather than clearing it', async () => {
    render(<WindCardsApp />);   // default: alto sax
    await userEvent.click(screen.getByRole('button', { name: 'C5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to board' }));
    const board = document.getElementById('wc-board-export')!;
    expect(within(board).getByText('Middle C')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Flute (Boehm, C foot)' }));
    // alto sax (-9) C5 sounds Eb4 (midi 63); flute (0) written at that midi
    // is spelled D#4 by the flute fingering chart (its own spelling wins), and
    // sits in the flute's low register.
    expect(board.querySelectorAll('.wc-card')).toHaveLength(1);
    expect(within(board).queryByText('Middle C')).toBeNull();
    expect(within(board).getByText('Low E♭ / D♯')).toBeInTheDocument();
  });

  it('adds a text card with a placeholder heading, edits it, and never plays it', async () => {
    const { playNote } = await import('@/audio/playback');
    render(<WindCardsApp />);
    await userEvent.click(screen.getByRole('button', { name: '+ Add text card' }));

    const board = document.getElementById('wc-board-export')!;
    const textCard = board.querySelector('.wc-text-card') as HTMLElement;
    expect(textCard).not.toBeNull();
    // Never created empty: an empty text card is an invisible box.
    expect(textCard.textContent).toContain('Section');
    // No fingering, no staff, and nothing to press play on.
    expect(textCard.querySelector('.wc-fingering')).toBeNull();
    expect(within(textCard).queryByRole('button', { name: 'Play voice' })).toBeNull();

    // The new card is selected, so its panel is open.
    const panel = document.querySelector('.wc-text-card-panel') as HTMLElement;
    const heading = within(panel).getByLabelText('Heading text') as HTMLInputElement;
    expect(heading.value).toBe('Section');
    await userEvent.clear(heading);
    await userEvent.type(heading, 'Warm-ups');
    expect(board.querySelector('.wc-text-card')!.textContent).toContain('Warm-ups');

    // An icon, then the same icon again to clear it.
    const iconBtn = panel.querySelector('.wc-icon-option') as HTMLElement;
    await userEvent.click(iconBtn);
    expect(board.querySelector('.wc-text-card-icon')).not.toBeNull();
    await userEvent.click(iconBtn);
    expect(board.querySelector('.wc-text-card-icon')).toBeNull();

    expect(playNote).not.toHaveBeenCalled();
  });

  it('keeps a text card through an instrument switch, and persists it', async () => {
    const { unmount } = render(<WindCardsApp />);
    await userEvent.click(screen.getByRole('button', { name: 'C5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to board' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Add text card' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Flute (Boehm, C foot)' }));

    const board = document.getElementById('wc-board-export')!;
    expect(board.querySelectorAll('.wc-board-item')).toHaveLength(2);
    expect(board.querySelector('.wc-text-card')!.textContent).toContain('Section');

    unmount();
    render(<WindCardsApp />);
    expect(document.getElementById('wc-board-export')!.querySelector('.wc-text-card')!.textContent).toContain('Section');
  });
});
