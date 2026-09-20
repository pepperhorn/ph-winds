import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Pitch } from '@/music/pitch';
import type { MusicFont } from '@/state/types';
import { isFontRegistered, isVerovioReady, musicFontToVerovioFont, onFontReady, onVerovioReady, renderStaffSvg } from './verovio';

export function StaffNote({
  pitch,
  clef,
  font,
  width,
}: {
  pitch: Pitch;
  clef: 'G' | 'F';
  font: MusicFont;
  width: number;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Distinguishes "the ~7 MB Verovio toolkit hasn't loaded yet at all" from
  // "toolkit's ready, this particular note is just queued behind the serial
  // render queue" (typically ~100ms) — the two showed the same static
  // skeleton before, which read as a hang during the real download.
  const toolkitReady = useSyncExternalStore(onVerovioReady, isVerovioReady);
  // Toolkit readiness alone isn't enough: switching Standard -> Handwritten
  // mid-session re-engraves every card behind the light skeleton while the
  // ~400 KB font chunk downloads — the exact hang the spinner above was
  // added to prevent, just for a font swap instead of first load. Track this
  // font's own registration state the same way, so that download shows the
  // same "Loading notation…" spinner rather than the light skeleton.
  const verovioFont = musicFontToVerovioFont(font);
  const fontReady = useSyncExternalStore(
    (cb) => onFontReady(verovioFont, cb),
    () => isFontRegistered(verovioFont),
  );

  useEffect(() => {
    let live = true;
    setFailed(false);
    setSvg(null);
    renderStaffSvg(pitch, clef, font).then(
      (s) => live && setSvg(s),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [pitch.step, pitch.alter, pitch.octave, clef, font]);

  if (failed) {
    return (
      <div className="wc-staff wc-staff--error text-xs text-muted" style={{ width }}>
        Notation unavailable
      </div>
    );
  }
  if (!svg && (!toolkitReady || !fontReady)) {
    return (
      // Deliberately no `role="status"`/`aria-live` here: a board can have
      // dozens of these mount at once, and a live region per staff means a
      // screen reader announces "Loading notation…" once per card. The
      // spinner stays purely visual; nothing today needs a single
      // board-level announcement badly enough to justify the plumbing a
      // shared region would need across `Board`/`Builder`.
      <div
        className="wc-staff wc-staff-loading flex items-center justify-center gap-2 rounded-lg bg-hairline px-2 text-xs text-muted motion-reduce:animate-pulse"
        style={{ width, height: width * 0.6 }}
      >
        <span
          className="wc-staff-spinner h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="truncate">Loading notation…</span>
      </div>
    );
  }
  if (!svg) {
    return (
      <div
        className="wc-staff wc-staff--loading animate-pulse rounded-lg bg-hairline"
        style={{ width, height: width * 0.6 }}
      />
    );
  }
  return (
    <div
      className="wc-staff [&_svg]:h-auto [&_svg]:w-full"
      style={{ width }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
