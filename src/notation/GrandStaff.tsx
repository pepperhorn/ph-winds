import { useEffect, useState } from 'react';
import type { MusicFont } from '@/state/types';
import { renderMusicXmlSvg } from './verovio';
import type { ScoreTransformOptions } from './scoreTransform';

export function GrandStaff({ musicXml, font, options }: { musicXml: string; font: MusicFont; options?: ScoreTransformOptions }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const optionsKey = JSON.stringify(options ?? {});

  useEffect(() => {
    let live = true;
    setSvg(null);
    setFailed(false);
    renderMusicXmlSvg(musicXml, font, options).then(
      (value) => live && setSvg(value),
      () => live && setFailed(true),
    );
    return () => { live = false; };
  }, [musicXml, font, optionsKey]);

  if (failed) return <p role="alert" className="wc-grand-staff wc-grand-staff--error py-6 text-center text-xs text-red-500">MusicXML could not be rendered.</p>;
  if (!svg) {
    return (
      <div className="wc-grand-staff wc-grand-staff--loading flex min-h-28 items-center justify-center gap-2 rounded-xl bg-canvas text-xs text-muted">
        <span className="wc-grand-staff-spinner size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
        Loading score…
      </div>
    );
  }
  return <div className="wc-grand-staff [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
