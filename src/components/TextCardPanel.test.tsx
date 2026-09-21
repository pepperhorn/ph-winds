import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextCardPanel } from './TextCardPanel';
import { CARD_ICONS } from './cardIcons';
import { createBoard } from '@/state/defaults';
import { newTextCardDraft } from '@/state/textCards';
import type { TextCard } from '@/state/types';

const meta = createBoard('saxophone').meta;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const card = (p: Partial<TextCard> = {}): TextCard => ({ id: 't', ...newTextCardDraft(), ...p });
const noop = () => {};
const props = { meta, onAdd: noop, onChange: noop, onPickImage: noop, onDone: noop };

describe('TextCardPanel', () => {
  it('always offers "+ Add text card", even with nothing selected', async () => {
    const onAdd = vi.fn();
    render(<TextCardPanel {...props} card={null} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: '+ Add text card' }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Choose a picture…' })).toBeNull();
  });

  it('groups the icons by category', () => {
    const { container } = render(<TextCardPanel {...props} card={card()} />);
    expect(screen.getByText('Notation')).toBeInTheDocument();
    expect(screen.getByText('Objects')).toBeInTheDocument();
    expect(container.querySelectorAll('.wc-icon-option')).toHaveLength(CARD_ICONS.length);
  });

  it('picking an icon reports it; clicking the selected one clears it', async () => {
    const onChange = vi.fn();
    const first = CARD_ICONS[0];
    const { rerender } = render(<TextCardPanel {...props} card={card()} onChange={onChange} />);
    const btn = () => document.querySelector(`[data-icon-id="${first.id}"]`) as HTMLElement;

    expect(btn()).toHaveAttribute('aria-pressed', 'false');
    expect(btn()).toHaveAttribute('title', first.label);
    await userEvent.click(btn());
    expect(onChange).toHaveBeenLastCalledWith({ icon: first.id });

    rerender(<TextCardPanel {...props} card={card({ icon: first.id })} onChange={onChange} />);
    expect(btn()).toHaveAttribute('aria-pressed', 'true');
    expect(btn()).toHaveAttribute('title', `${first.label} (click to clear)`);
    await userEvent.click(btn());
    expect(onChange).toHaveBeenLastCalledWith({ icon: undefined });
  });

  it('accepts only raster picture types, and previews a stored picture', () => {
    const { container, rerender } = render(<TextCardPanel {...props} card={card()} />);
    const input = container.querySelector('.wc-picture-input') as HTMLInputElement;
    expect(input.getAttribute('accept')).toBe('image/png,image/jpeg,image/webp');
    expect(screen.getByRole('button', { name: 'Choose a picture…' })).toBeInTheDocument();

    rerender(<TextCardPanel {...props} card={card({ image: PNG })} />);
    expect(screen.getByRole('button', { name: 'Replace picture…' })).toBeInTheDocument();
    expect((screen.getByAltText('Card picture') as HTMLImageElement).getAttribute('src')).toBe(PNG);
  });

  it('removing the picture patches it away', async () => {
    const onChange = vi.fn();
    render(<TextCardPanel {...props} card={card({ image: PNG })} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenLastCalledWith({ image: undefined });
  });

  it('hands a picked file straight to the host, and resets the input so the same file can be retried', async () => {
    const onPickImage = vi.fn();
    const { container } = render(<TextCardPanel {...props} card={card()} onPickImage={onPickImage} />);
    const input = container.querySelector('.wc-picture-input') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'a.png', { type: 'image/png' }));
    expect(onPickImage).toHaveBeenCalledOnce();
    expect(onPickImage.mock.calls[0][0]).toBeInstanceOf(File);
    expect(input.value).toBe('');
  });

  it('surfaces a picture error as an alert', () => {
    render(<TextCardPanel {...props} card={card()} imageError="That picture is too big to open (30.0 MB)." />);
    expect(screen.getByRole('alert')).toHaveTextContent('That picture is too big to open (30.0 MB).');
  });

  it('edits the three text slots through the shared controls', async () => {
    const onChange = vi.fn();
    render(<TextCardPanel {...props} card={card()} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Footer text'), 'p');
    expect(onChange).toHaveBeenLastCalledWith({ text: { heading: { text: 'Section' }, footer: { text: 'p' } } });
  });
});
