import { useEffect, useState } from 'react';
import type { Pitch } from '@/music/pitch';
import type { MusicFont } from '@/state/types';
import { renderStaffSvg } from './verovio';

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
