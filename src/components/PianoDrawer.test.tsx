import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PianoDrawer } from './PianoDrawer';

function renderDrawer(open: boolean) {
  return render(
    <PianoDrawer
      open={open}
      onToggle={vi.fn()}
      soundOnClick={false}
      onSoundOnClick={vi.fn()}
      soundVoice="voice"
      onSoundVoice={vi.fn()}
    >
      <div>keyboard placeholder</div>
    </PianoDrawer>,
  );
}

describe('PianoDrawer', () => {
  it('gives both sound-voice options a semantic wc- class name', () => {
    const { container } = renderDrawer(true);
    const instrumentOption = container.querySelector('option[value="voice"]');
    const pianoOption = container.querySelector('option[value="piano"]');
    expect(instrumentOption).toHaveClass('wc-sound-voice-option');
    expect(pianoOption).toHaveClass('wc-sound-voice-option');
  });

  it('makes the panel inert when closed and interactive when open', () => {
    const { container: closed } = renderDrawer(false);
    const closedPanel = closed.querySelector('.wc-piano-panel');
    expect(closedPanel).toHaveAttribute('inert');

    const { container: opened } = renderDrawer(true);
    const openedPanel = opened.querySelector('.wc-piano-panel');
    expect(openedPanel).not.toHaveAttribute('inert');
  });
});
