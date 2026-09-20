import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WindCardsApp from './WindCardsApp';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));
vi.mock('@/notation/verovio', () => ({ prefetchVerovioWhenIdle: () => () => {}, pendingRenders: () => Promise.resolve() }));
vi.mock('@/audio/playback', () => ({ playNote: vi.fn(() => Promise.resolve()), releaseVoicesExcept: vi.fn(), isVoiceLoaded: () => true }));

describe('WindCardsApp', () => {
  beforeEach(() => localStorage.clear());
  it('picks a note on the piano, adds a card, persists it', async () => {
    const { unmount } = render(<WindCardsApp />);
    await userEvent.click(screen.getByRole('button', { name: 'C5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to board' }));
    const board = document.getElementById('wc-board-export')!;
    expect(within(board).getByText('C5')).toBeInTheDocument();
    unmount();
    render(<WindCardsApp />);
    expect(within(document.getElementById('wc-board-export')!).getByText('C5')).toBeInTheDocument();
  });
  it('concert mode maps key clicks to written pitch', async () => {
    render(<WindCardsApp />);   // default: alto sax
    await userEvent.click(screen.getByRole('radio', { name: 'Concert' }));
    await userEvent.click(screen.getByRole('button', { name: 'E♭4' }));
    expect(within(document.querySelector('.wc-builder-preview')!).getByText('C5')).toBeInTheDocument();
  });
  it('switching instrument remaps the board rather than clearing it', async () => {
    render(<WindCardsApp />);   // default: alto sax
    await userEvent.click(screen.getByRole('button', { name: 'C5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to board' }));
    const board = document.getElementById('wc-board-export')!;
    expect(within(board).getByText('C5')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Instrument'), 'flute');
    // alto sax (-9) C5 sounds Eb4 (midi 63); flute (0) written at that midi
    // is spelled D#4 by the flute fingering chart (its own spelling wins).
    expect(board.querySelectorAll('.wc-card')).toHaveLength(1);
    expect(within(board).queryByText('C5')).toBeNull();
    expect(within(board).getByText('D♯4')).toBeInTheDocument();
  });
});
