import { useEffect, useRef } from 'react';
import { Button } from './ui';

const CREDITS = [
  ['Fingering diagrams', '@pepperhorn/fingering-components (MIT)'],
  ['Notation', 'Verovio (LGPL-3.0); Bravura and Petaluma by Steinberg (SIL OFL 1.1)'],
  ['Sounds', 'FluidR3_GM by Frank Wen (MIT), via gleitz/midi-js-soundfonts (CC BY 3.0)'],
  ['Recorder samples', 'Versilian Community Sample Library by Sam Gossner (CC0)'],
  ['Playback', 'smplr by danigb (MIT)'],
];

export function AboutDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal?.(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="wc-about m-auto max-w-md rounded-3xl border border-hairline p-6 shadow-glow-strong backdrop:bg-ink/30">
      <h2 className="wc-about-title text-lg font-semibold">ph-winds</h2>
      <p className="wc-about-tagline mt-1 text-sm text-muted">Fingering and notation cards for wind instruments.</p>
      <dl className="wc-credits mt-4 space-y-2 text-sm">
        {CREDITS.map(([k, v]) => (
          <div key={k} className="wc-credit-row">
            <dt className="wc-credit-term font-medium">{k}</dt>
            <dd className="wc-credit-desc text-muted">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="wc-about-actions mt-6 flex justify-end">
        <Button variant="tonal" onClick={onClose} className="btn-about-close">Close</Button>
      </div>
    </dialog>
  );
}
