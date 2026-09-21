import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardView, TextCardView } from './TextCardView';
import { createBoard, newCardDraft } from '@/state/defaults';
import { newTextCardDraft } from '@/state/textCards';
import { parsePitch } from '@/music/pitch';
import type { TextCard } from '@/state/types';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));

const meta = { ...createBoard('saxophone').meta, horn: 'alto' };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const textCard = (p: Partial<TextCard> = {}): TextCard => ({ id: 't', ...newTextCardDraft(), ...p });

describe('TextCardView', () => {
  it('shows its three text slots', () => {
    render(<TextCardView meta={meta} card={textCard({
      text: { heading: { text: 'Warm-ups' }, subtitle: { text: 'Long tones' }, footer: { text: 'p. 4', show: true } },
    })} />);
    expect(screen.getByText('Warm-ups')).toBeInTheDocument();
    expect(screen.getByText('Long tones')).toBeInTheDocument();
    expect(screen.getByText('p. 4')).toBeInTheDocument();
  });

  it('renders an icon when one is set', () => {
    const { container } = render(<TextCardView meta={meta} card={textCard({ icon: 'music:trebleClef' })} />);
    expect(container.querySelector('.wc-text-card-icon')).not.toBeNull();
    expect(container.querySelector('.wc-text-card-image')).toBeNull();
  });

  it('renders a picture with an <img>, and never an <object>/<iframe>/<embed>', () => {
    const { container } = render(<TextCardView meta={meta} card={textCard({ image: PNG })} />);
    const img = container.querySelector('img.wc-text-card-image') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(PNG);
    // An SVG data URI is inert in an <img> and executable in these three.
    expect(container.querySelector('object, iframe, embed')).toBeNull();
    expect(container.querySelector('.wc-text-card-icon')).toBeNull();
  });

  it('honours TextField size/align/show', () => {
    const { container } = render(<TextCardView meta={meta} card={textCard({
      text: { heading: { text: 'Big left', size: 'L', align: 'left' }, subtitle: { text: 'hidden', show: false } },
    })} />);
    const heading = container.querySelector('.wc-text-card-heading')!;
    expect(heading.className).toContain('text-lg');
    expect(heading.className).toContain('text-left');
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('scales', () => {
    const { container } = render(<TextCardView meta={meta} card={textCard({ scale: 2 })} />);
    expect((container.querySelector('.wc-text-card') as HTMLElement).style.width).toBe('336px');
  });

  it('gets no pitch-derived text, unlike the fingering card beside it', () => {
    // The real, load-bearing difference between `resolveTextCardText` and
    // `resolveCardText`: the fingering path fills an empty slot from the
    // card's pitch, and the text path has no pitch to fill anything from. It
    // leaves what was typed, and leaves an untyped slot empty.
    const { container } = render(<TextCardView meta={meta} card={{ id: 't', kind: 'text', scale: 1, text: { heading: { text: 'Warm-ups' } } }} />);
    expect(screen.getByText('Warm-ups')).toBeInTheDocument();
    expect(container.querySelector('.wc-text-card-subtitle')).toBeNull();

    // The same board, the same empty slots, on a fingering card: both filled.
    // The heading is the resolved `{noteName}` label, so it is not asserted
    // against a literal — the library's band names and boundaries move.
    const fingering = render(<CardView meta={meta} card={{ id: 'a', ...newCardDraft(parsePitch('C5')) }} />);
    expect(fingering.container.querySelector('.wc-card-heading')?.textContent).toBeTruthy();
    expect(fingering.container.querySelector('.wc-card-subtitle')?.textContent).toMatch(/Concert Pitch/);
  });

  // The other half of the same rule, now that `resolveCardText` does resolve
  // `{noteName}` and friends: `resolveTextCardText` is a separate merge loop
  // and must NOT grow substitution — a text card has no pitch to resolve
  // against — so a wildcard typed on one stays exactly as typed.
  it('leaves wildcard tokens literal, having no pitch to resolve them against', () => {
    render(<TextCardView meta={meta} card={{ id: 't', kind: 'text', scale: 1, text: { heading: { text: '{noteName}' }, subtitle: { text: 'sounds {concertPitch}' } } }} />);
    expect(screen.getByText('{noteName}')).toBeInTheDocument();
    expect(screen.getByText('sounds {concertPitch}')).toBeInTheDocument();
  });

  it('a card with no art and no text renders a visible placeholder, not an invisible box', () => {
    const { container } = render(<TextCardView meta={meta} card={{ id: 't', kind: 'text', scale: 1 }} />);
    const placeholder = container.querySelector('.wc-text-card-placeholder')!;
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveAttribute('data-export-hide');
    expect(container.querySelector('.wc-text-card-placeholder')!.textContent).toMatch(/Empty text card/);
  });

  it('drops the placeholder as soon as the card has anything to show', () => {
    const { container } = render(<TextCardView meta={meta} card={textCard()} />);
    expect(container.querySelector('.wc-text-card-placeholder')).toBeNull();
  });
});

describe('CardView dispatch', () => {
  it('a text card never reaches fingering rendering', () => {
    const { container } = render(<CardView meta={meta} card={textCard({ text: { heading: { text: 'Section' } } })} />);
    expect(container.querySelector('.wc-text-card')).not.toBeNull();
    expect(container.querySelector('.wc-fingering')).toBeNull();
    expect(screen.queryByTestId('staff')).toBeNull();
    // No play buttons: a text card has nothing to sound.
    expect(screen.queryByRole('button', { name: 'Play voice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play piano' })).toBeNull();
  });

  it('a fingering card still renders its diagram and staff', () => {
    const { container } = render(<CardView meta={meta} card={{ id: 'a', ...newCardDraft(parsePitch('C5')) }} />);
    expect(container.querySelector('.wc-fingering svg')).not.toBeNull();
    expect(screen.getByTestId('staff')).toBeInTheDocument();
    expect(container.querySelector('.wc-text-card')).toBeNull();
  });
});
