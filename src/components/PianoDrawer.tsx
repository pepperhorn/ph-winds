import type { ReactNode } from 'react';

export function PianoDrawer({ open, onToggle, soundOnClick, onSoundOnClick, soundVoice, onSoundVoice, children }: {
  open: boolean; onToggle(): void;
  soundOnClick: boolean; onSoundOnClick(v: boolean): void;
  soundVoice: 'voice' | 'piano'; onSoundVoice(v: 'voice' | 'piano'): void;
  children: ReactNode;
}) {
  return (
    <div className={`wc-piano-drawer fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-[calc(100%-2.25rem)]'}`}>
      <div className="wc-piano-handle-row flex justify-center">
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="btn-piano-toggle h-9 rounded-t-xl border border-b-0 border-hairline bg-surface px-5 text-sm font-medium text-ink shadow-glow">
          {open ? 'Hide keyboard ▾' : 'Show keyboard ▴'}
        </button>
      </div>
      <div className="wc-piano-panel border-t border-hairline bg-surface/95 px-4 pb-4 pt-3 shadow-[0_-8px_30px_-12px_rgb(109_93_252/.35)] backdrop-blur" inert={!open ? true : undefined}>
        <div className="wc-piano-toolbar mb-2 flex flex-wrap items-center gap-4 text-xs text-muted">
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
        {children}
      </div>
    </div>
  );
}
