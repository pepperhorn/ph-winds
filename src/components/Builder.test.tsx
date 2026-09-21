import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Builder } from './Builder';
import { createBoard, newCardDraft } from '@/state/defaults';
import { parsePitch } from '@/music/pitch';

vi.mock('@/notation/StaffNote', () => ({ StaffNote: () => <div data-testid="staff" /> }));
const meta = createBoard('clarinet').meta;

const noop = { onMeta: vi.fn(), onInstrument: vi.fn() };

describe('Builder', () => {
  it('prompts when no note is picked', () => {
    render(<Builder draft={null} meta={meta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} {...noop} />);
    expect(screen.getByText(/Pick a note on the keyboard below/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to board' })).toBeDisabled();
  });
  it('lists alternates and switches display', async () => {
    const onChange = vi.fn();
    const draft = newCardDraft(parsePitch('E3'));
    render(<Builder draft={draft} meta={meta} onChange={onChange} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} {...noop} />);
    const alts = screen.getAllByRole('radio', { name: /Fingering \d/ });
    expect(alts).toHaveLength(2);
    await userEvent.click(alts[1]);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fingeringIndex: 1 }));
    await userEvent.click(screen.getByRole('radio', { name: 'Notation' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ display: 'notation' }));
  });
  // A placeholder promises "this is what you get if you leave this blank", so
  // it has to be the resolved heading, not the bare pitch — the preview card
  // right above it shows the resolved one.
  it('offers the resolved heading, matching the preview card, as the Heading placeholder', () => {
    const draft = newCardDraft(parsePitch('E4'));
    const { container } = render(<Builder draft={draft} meta={meta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} {...noop} />);
    const shown = container.querySelector('.wc-card-heading')!.textContent;
    expect(screen.getByRole('textbox', { name: 'Heading text' })).toHaveAttribute('placeholder', shown);
    // And the subtitle placeholder agrees with its card line the same way.
    expect(screen.getByRole('textbox', { name: 'Subtitle text' }))
      .toHaveAttribute('placeholder', container.querySelector('.wc-card-subtitle')?.textContent ?? '');
  });
  it('keeps showing the default heading in the placeholder while the user types over it', () => {
    const draft = { ...newCardDraft(parsePitch('E4')), text: { heading: { text: 'My own words' } } };
    const { container } = render(<Builder draft={draft} meta={meta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} {...noop} />);
    const input = screen.getByRole('textbox', { name: 'Heading text' });
    expect(input).toHaveValue('My own words');
    expect(container.querySelector('.wc-card-heading')!.textContent).toBe('My own words');
    // The placeholder is what they'd get back by clearing the field.
    expect(input.getAttribute('placeholder')).not.toBe('My own words');
    expect(input.getAttribute('placeholder')).toBeTruthy();
  });
  it('commits and shows Update when editing', async () => {
    const onCommit = vi.fn();
    render(<Builder draft={{ ...newCardDraft(parsePitch('E3')), editingId: 'x' }} meta={meta} onChange={vi.fn()} onCommit={onCommit} onCancelEdit={vi.fn()} onPlay={vi.fn()} {...noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Update card' }));
    expect(onCommit).toHaveBeenCalled();
  });
  it('disables Add to board and shows a hint when the drafted note has no fingering on the current instrument', () => {
    const draft = newCardDraft(parsePitch('C2')); // out of range for every instrument here
    render(<Builder draft={draft} meta={meta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} {...noop} />);
    expect(screen.getByRole('button', { name: 'Add to board' })).toBeDisabled();
    expect(screen.getByText(/not available on Clarinet/)).toBeInTheDocument();
    expect(document.querySelector('.wc-builder-unavailable-hint')).not.toBeNull();
  });
  it('carries the board-settings main strip: instrument change calls onInstrument directly, without a confirm prompt', async () => {
    const onInstrument = vi.fn();
    const confirm = vi.spyOn(window, 'confirm');
    render(<Builder draft={null} meta={meta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} onMeta={vi.fn()} onInstrument={onInstrument} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Flute (Boehm, C foot)' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onInstrument).toHaveBeenCalledWith('flute');
  });
  it('exposes horn select, Pitch/Music font/Diagram/Columns segmented controls', async () => {
    const onMeta = vi.fn();
    const saxMeta = createBoard('saxophone').meta;
    render(<Builder draft={null} meta={saxMeta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} onMeta={onMeta} onInstrument={vi.fn()} />);
    expect(screen.getByLabelText('Horn')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Concert Pitch (Piano)' }));
    expect(onMeta).toHaveBeenCalledWith({ pitchMode: 'concert' });
    await userEvent.click(screen.getByRole('radio', { name: 'Handwritten' }));
    expect(onMeta).toHaveBeenCalledWith({ musicFont: 'petaluma' });
    // "Horizontal" also labels the per-card Card layout control, so scope this
    // to the board-level Orientation radiogroup rather than querying globally.
    const orientation = screen.getByRole('radiogroup', { name: 'Orientation:' });
    await userEvent.click(within(orientation).getByRole('radio', { name: 'Horizontal' }));
    expect(onMeta).toHaveBeenCalledWith({ diagramOrient: 'horizontal' });
    await userEvent.click(screen.getByRole('radio', { name: '2' }));
    expect(onMeta).toHaveBeenCalledWith({ columns: 2 });
  });
});
