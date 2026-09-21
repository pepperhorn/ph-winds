import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WindCard } from './WindCard';
import { createBoard, newCardDraft } from '@/state/defaults';
import { parsePitch } from '@/music/pitch';
import { useRegisters } from '@/test/registers';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));

const meta = { ...createBoard('saxophone').meta, horn: 'alto' };

// Fixture register bands (C4 -> "Mid", D5 -> "Top"), so the headings below
// pin card *behaviour* rather than the library's current boundaries.
useRegisters('saxophone');

describe('WindCard', () => {
  it('shows heading, subtitle, diagram and staff by default', () => {
    const { container } = render(<WindCard card={newCardDraft(parsePitch('C5'))} meta={meta} />);
    expect(screen.getByText('Mid C')).toBeInTheDocument();
    expect(screen.getByText('Concert Pitch: E♭4 / D♯4')).toBeInTheDocument();
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
  it('renders a greyed unavailable card when the note has no fingering, with no diagram/staff/play buttons', () => {
    const onPlay = vi.fn();
    const { container } = render(<WindCard card={newCardDraft(parsePitch('C2'))} meta={meta} onPlay={onPlay} showPlay="always" />);
    expect(container.querySelector('.wc-card--unavailable')).not.toBeNull();
    expect(screen.getByText('C2')).toBeInTheDocument();
    expect(screen.getByText('not available on E♭ alto Saxophone')).toBeInTheDocument();
    expect(container.querySelector('.wc-fingering')).toBeNull();
    expect(screen.queryByTestId('staff')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play voice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play piano' })).toBeNull();
    expect(container.querySelector('.wc-card')).toHaveAttribute('data-export-hide');
  });
  it('shows both enharmonic spellings for an unavailable accidental pitch', () => {
    const { container } = render(<WindCard card={newCardDraft(parsePitch('C#1'))} meta={meta} />);
    expect(container.querySelector('.wc-card--unavailable')).not.toBeNull();
    expect(screen.getByText('D♭1 / C♯1')).toBeInTheDocument();
    expect(screen.getByText('not available on E♭ alto Saxophone')).toBeInTheDocument();
  });
  it('shows the user\'s own heading override instead of the pitch pair when set, keeping the "not available" line underneath', () => {
    const draft = { ...newCardDraft(parsePitch('C2')), text: { heading: { text: 'My low C' } } };
    render(<WindCard card={draft} meta={meta} />);
    expect(screen.getByText('My low C')).toBeInTheDocument();
    expect(screen.queryByText('C2')).toBeNull();
    expect(screen.getByText('not available on E♭ alto Saxophone')).toBeInTheDocument();
  });
  // An unavailable card gets its heading from the same rule as a live one —
  // `resolveCardText` — so a board can never show two heading formats side by
  // side. Nothing pinned this before, which is how it drifted.
  it('applies the board-level card-text heading template to an unavailable card', () => {
    const m = { ...meta, cardText: { ...meta.cardText, heading: { ...meta.cardText.heading, text: 'Note: {transposedPitch}' } } };
    render(<WindCard card={newCardDraft(parsePitch('C2'))} meta={m} />);
    expect(screen.getByText('Note: C2')).toBeInTheDocument();
    expect(screen.getByText('not available on E♭ alto Saxophone')).toBeInTheDocument();
  });
  it('names an unavailable card by register, exactly as a live card would', () => {
    // Written G7 is off the top of the alto-sax chart but still sits inside a
    // band, so the heading is the register-aware name a live card would get,
    // not the bare pitch. (C2, below every band, keeps falling back to the
    // pitch pair — the case above.)
    render(<WindCard card={newCardDraft(parsePitch('G7'))} meta={meta} />);
    expect(screen.getByText('Top G')).toBeInTheDocument();
    expect(screen.queryByText('G7')).toBeNull();
    expect(screen.getByText('not available on E♭ alto Saxophone')).toBeInTheDocument();
  });
  it('uses the short instrument name (no parenthetical) for a horn-less instrument', () => {
    const recorderMeta = createBoard('recorder').meta;
    render(<WindCard card={newCardDraft(parsePitch('C2'))} meta={recorderMeta} />);
    expect(screen.getByText('not available on Recorder')).toBeInTheDocument();
  });
  it('an available card carries no data-export-hide attribute', () => {
    const { container } = render(<WindCard card={newCardDraft(parsePitch('C5'))} meta={meta} />);
    expect(container.querySelector('.wc-card')).not.toHaveAttribute('data-export-hide');
  });
  it('marks the play-voice button as busy while its voice loads', () => {
    render(<WindCard card={newCardDraft(parsePitch('C5'))} meta={meta} onPlay={vi.fn()} showPlay="always" loadingPlay="voice" />);
    expect(screen.getByRole('button', { name: 'Play voice' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Play piano' })).toHaveAttribute('aria-busy', 'false');
  });
});
