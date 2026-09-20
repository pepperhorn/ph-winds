import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PianoPanel } from './PianoPanel';

function renderPanel(open: boolean) {
  return render(
    <PianoPanel
      open={open}
      onToggle={vi.fn()}
      soundOnClick={false}
      onSoundOnClick={vi.fn()}
      soundVoice="voice"
      onSoundVoice={vi.fn()}
    >
      <div>keyboard placeholder</div>
    </PianoPanel>,
  );
}

describe('PianoPanel', () => {
  it('gives both sound-voice options a semantic wc- class name', () => {
    const { container } = renderPanel(true);
    const instrumentOption = container.querySelector('option[value="voice"]');
    const pianoOption = container.querySelector('option[value="piano"]');
    expect(instrumentOption).toHaveClass('wc-sound-voice-option');
    expect(pianoOption).toHaveClass('wc-sound-voice-option');
  });

  it('makes the panel content inert when closed and interactive when open', () => {
    const { container: closed } = renderPanel(false);
    const closedBody = closed.querySelector('.wc-piano-body');
    expect(closedBody).toHaveAttribute('inert');

    const { container: opened } = renderPanel(true);
    const openedBody = opened.querySelector('.wc-piano-body');
    expect(openedBody).not.toHaveAttribute('inert');
  });
});
