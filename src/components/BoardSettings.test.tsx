import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardSettings } from './BoardSettings';
import { createBoard } from '@/state/defaults';

describe('BoardSettings', () => {
  it('asks before changing instrument when the board has cards', async () => {
    const onInstrument = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<BoardSettings meta={createBoard('saxophone').meta} hasCards onMeta={vi.fn()} onInstrument={onInstrument} />);
    await userEvent.selectOptions(screen.getByLabelText('Instrument'), 'flute');
    expect(confirm).toHaveBeenCalled();
    expect(onInstrument).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.selectOptions(screen.getByLabelText('Instrument'), 'flute');
    expect(onInstrument).toHaveBeenCalledWith('flute', undefined);
  });
  it('toggles pitch mode and variant chips', async () => {
    const onMeta = vi.fn();
    render(<BoardSettings meta={createBoard('saxophone').meta} hasCards={false} onMeta={onMeta} onInstrument={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Concert' }));
    expect(onMeta).toHaveBeenCalledWith({ pitchMode: 'concert' });
    await userEvent.click(screen.getByRole('button', { name: 'Diagram style' }));
    await userEvent.click(screen.getByRole('button', { name: 'palm-bean' }));
    expect(onMeta).toHaveBeenLastCalledWith({ style: expect.objectContaining({ variants: ['palm-bean'] }) });
  });
});
