import type { ReactNode } from 'react';

export function PianoPanel({ open, onToggle, soundOnClick, onSoundOnClick, soundVoice, onSoundVoice, children }: {
  open: boolean; onToggle(): void;
  soundOnClick: boolean; onSoundOnClick(v: boolean): void;
  soundVoice: 'voice' | 'piano'; onSoundVoice(v: 'voice' | 'piano'): void;
  children: ReactNode;
}) {
  return (
    <section className="wc-piano-panel rounded-2xl border border-hairline bg-canvas p-4">
      <div className="wc-piano-toolbar flex flex-wrap items-center gap-4 text-xs text-muted">
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="wc-piano-toggle btn-piano-toggle rounded-full border border-hairline bg-surface px-4 py-1.5 text-sm font-medium text-ink shadow-glow">
          {/* In-flow panel: expanding reveals the keyboard below, so the
              closed state points down (there's more to show below) and the
              open state points up (collapsing pulls content back up). */}
          {open ? 'Hide keyboard ▴' : 'Show keyboard ▾'}
        </button>
        <span className="wc-piano-legend flex items-center gap-3">
          <i className="wc-legend-swatch inline-block size-3 rounded bg-band-beginner" /> Beginner
          <i className="wc-legend-swatch inline-block size-3 rounded bg-band-intermediate" /> Intermediate
          <i className="wc-legend-swatch inline-block size-3 rounded bg-band-pro" /> Pro
        </span>
        <label className="wc-sound-toggle ml-auto flex items-center gap-2">
          <input className="wc-sound-toggle-input" type="checkbox" checked={soundOnClick} onChange={(e) => onSoundOnClick(e.target.checked)} /> Sound on click
        </label>
        <select className="wc-sound-voice rounded-md border border-hairline bg-surface px-2 py-1" value={soundVoice}
          onChange={(e) => onSoundVoice(e.target.value as 'voice' | 'piano')} disabled={!soundOnClick}>
          <option className="wc-sound-voice-option wc-sound-voice-option--instrument" value="voice">Instrument</option>
          <option className="wc-sound-voice-option wc-sound-voice-option--piano" value="piano">Piano</option>
        </select>
      </div>
      <div className="wc-piano-body mt-3" hidden={!open} inert={!open ? true : undefined}>
        {children}
      </div>
    </section>
  );
}
