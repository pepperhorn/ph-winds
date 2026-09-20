import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('commits and shows Update when editing', async () => {
    const onCommit = vi.fn();
    render(<Builder draft={{ ...newCardDraft(parsePitch('E3')), editingId: 'x' }} meta={meta} onChange={vi.fn()} onCommit={onCommit} onCancelEdit={vi.fn()} onPlay={vi.fn()} {...noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Update card' }));
    expect(onCommit).toHaveBeenCalled();
  });
  it('carries the board-settings main strip: instrument change calls onInstrument directly, without a confirm prompt', async () => {
    const onInstrument = vi.fn();
    const confirm = vi.spyOn(window, 'confirm');
    render(<Builder draft={null} meta={meta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} onMeta={vi.fn()} onInstrument={onInstrument} />);
    await userEvent.selectOptions(screen.getByLabelText('Instrument'), 'flute');
    expect(confirm).not.toHaveBeenCalled();
    expect(onInstrument).toHaveBeenCalledWith('flute');
  });
  it('exposes horn select, Pitch/Music font/Diagram/Columns segmented controls', async () => {
    const onMeta = vi.fn();
    const saxMeta = createBoard('saxophone').meta;
    render(<Builder draft={null} meta={saxMeta} onChange={vi.fn()} onCommit={vi.fn()} onCancelEdit={vi.fn()} onPlay={vi.fn()} onMeta={onMeta} onInstrument={vi.fn()} />);
    expect(screen.getByLabelText('Horn')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Concert' }));
    expect(onMeta).toHaveBeenCalledWith({ pitchMode: 'concert' });
    await userEvent.click(screen.getByRole('radio', { name: 'Petaluma' }));
    expect(onMeta).toHaveBeenCalledWith({ musicFont: 'petaluma' });
    await userEvent.click(screen.getByRole('radio', { name: 'Sideways' }));
    expect(onMeta).toHaveBeenCalledWith({ diagramOrient: 'horizontal' });
    await userEvent.click(screen.getByRole('radio', { name: '2' }));
    expect(onMeta).toHaveBeenCalledWith({ columns: 2 });
  });
});
