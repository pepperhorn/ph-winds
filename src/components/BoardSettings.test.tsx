import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardSettings } from './BoardSettings';
import { createBoard } from '@/state/defaults';

describe('BoardSettings', () => {
  it('has no instrument/horn/pitch controls — those moved into the builder', () => {
    render(<BoardSettings meta={createBoard('saxophone').meta} onMeta={vi.fn()} />);
    expect(screen.queryByLabelText('Instrument')).toBeNull();
    expect(screen.queryByLabelText('Horn')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Concert Pitch (Piano)' })).toBeNull();
  });
  it('toggles variant chips in the Diagram style section', async () => {
    const onMeta = vi.fn();
    render(<BoardSettings meta={createBoard('saxophone').meta} onMeta={onMeta} />);
    await userEvent.click(screen.getByRole('button', { name: 'Diagram style' }));
    await userEvent.click(screen.getByRole('button', { name: 'palm-bean' }));
    expect(onMeta).toHaveBeenLastCalledWith({ style: expect.objectContaining({ variants: ['palm-bean'] }) });
  });
  it('edits board text defaults', async () => {
    const onMeta = vi.fn();
    render(<BoardSettings meta={createBoard('saxophone').meta} onMeta={onMeta} />);
    await userEvent.click(screen.getByRole('button', { name: 'Text' }));
    await userEvent.type(screen.getByLabelText('Title text'), 'X');
    expect(onMeta).toHaveBeenCalledWith({ title: expect.objectContaining({ text: 'X' }) });
  });
});
