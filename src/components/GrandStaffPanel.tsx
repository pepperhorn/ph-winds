import { useRef, useState } from 'react';
import type { BoardMeta } from '@/state/types';
import { ACCEPTED_MUSIC_XML_TYPES, musicXmlFromFile } from '@/state/musicXml';
import { GrandStaff } from '@/notation/GrandStaff';
import { Button, Slider } from './ui';

export function GrandStaffPanel({ meta, onMeta }: { meta: BoardMeta; onMeta(patch: Partial<BoardMeta>): void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const score = meta.grandStaff;

  const pick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      onMeta({ grandStaff: await musicXmlFromFile(file) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'MusicXML could not be read.');
    }
  };

  return (
    <div className="wc-grand-staff-panel mt-6">
      <div data-export-hide className="wc-grand-staff-controls mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-canvas px-4 py-3">
        <input ref={fileRef} type="file" accept={ACCEPTED_MUSIC_XML_TYPES} aria-label="Grand staff MusicXML"
          className="wc-grand-staff-input hidden" onChange={(e) => {
            void pick(e.target.files?.[0] ?? null);
            e.target.value = '';
          }} />
        <div className="wc-grand-staff-upload min-w-48 flex-1">
          <p className="wc-grand-staff-title text-sm font-medium text-ink">Grand staff</p>
          <p className="wc-grand-staff-help truncate text-xs text-muted">
            {score ? score.fileName : 'Upload MusicXML with treble, bass, or both staves.'}
          </p>
        </div>
        <Button variant="tonal" className="btn-grand-staff-upload" onClick={() => fileRef.current?.click()}>
          {score ? 'Replace MusicXML…' : 'Upload MusicXML…'}
        </Button>
        {score && <Button variant="text" className="btn-grand-staff-remove" onClick={() => onMeta({ grandStaff: undefined })}>Remove</Button>}
        {score && (
          <div className="wc-grand-staff-size min-w-56 flex-1">
            <Slider label="Size" value={score.scale} min={0.5} max={2} step={0.1}
              onChange={(scale) => onMeta({ grandStaff: { ...score, scale } })}
              format={(value) => `${Math.round(value * 100)}%`} />
          </div>
        )}
        {error && <p role="alert" className="wc-grand-staff-upload-error basis-full text-xs text-red-500">{error}</p>}
      </div>
      {score && (
        <div className="wc-grand-staff-scroll overflow-x-auto">
          <div className="wc-grand-staff-sized mx-auto min-w-0" style={{ width: `${score.scale * 100}%` }}>
            <GrandStaff musicXml={score.musicXml} font={meta.musicFont} />
          </div>
        </div>
      )}
    </div>
  );
}
