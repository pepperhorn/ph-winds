import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextFieldControls, WildcardHint } from './TextFieldControls';
import { BoardSettings } from './BoardSettings';
import { createBoard } from '@/state/defaults';

const base = { text: '', show: true, size: 'M' as const, align: 'center' as const };

describe('WildcardHint', () => {
  it('keeps the token list collapsed until the ⓘ is pressed', async () => {
    render(<WildcardHint />);
    const btn = screen.getByRole('button', { name: 'About wildcards' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('{noteName}')).not.toBeInTheDocument();

    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    for (const t of ['{noteName}', '{transposedPitch}', '{concertPitch}']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }

    await userEvent.click(btn);
    expect(screen.queryByText('{noteName}')).not.toBeInTheDocument();
  });
  it('points aria-controls at the popover only while it exists', async () => {
    render(<WildcardHint />);
    const btn = screen.getByRole('button', { name: 'About wildcards' });
    expect(btn).not.toHaveAttribute('aria-controls');
    await userEvent.click(btn);
    const id = btn.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).not.toBeNull();
  });
  it('closes on Escape and hands focus back to the ⓘ', async () => {
    render(<WildcardHint />);
    const btn = screen.getByRole('button', { name: 'About wildcards' });
    await userEvent.click(btn);
    expect(screen.getByText('{noteName}')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('{noteName}')).not.toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn).toHaveFocus();
  });
  it('closes on a click outside, and stays open for a click inside', async () => {
    render(<><WildcardHint /><button type="button">Elsewhere</button></>);
    const btn = screen.getByRole('button', { name: 'About wildcards' });
    await userEvent.click(btn);

    // Inside the popover: still open.
    await userEvent.click(screen.getByText('{noteName}'));
    expect(screen.getByText('{noteName}')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByText('{noteName}')).not.toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('TextFieldControls', () => {
  it('no longer prints a wildcard reminder under the input', () => {
    render(<TextFieldControls label="Heading" value={{}} base={base} onChange={vi.fn()} />);
    expect(document.querySelector('.wc-text-field-hint')).toBeNull();
    expect(screen.queryByText(/^Wildcards:/)).not.toBeInTheDocument();
  });
});

describe('BoardSettings', () => {
  it('shows exactly one wildcard ⓘ, on the card defaults group and not on board chrome', async () => {
    const meta = createBoard('saxophone').meta;
    render(<BoardSettings meta={meta} onMeta={vi.fn()} />);
    // The Text section is collapsed behind a <details>; open it first.
    await userEvent.click(screen.getByText('Text'));
    expect(screen.getAllByRole('button', { name: 'About wildcards' })).toHaveLength(1);
  });
});
