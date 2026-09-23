import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { BoardMeta, GrandStaff as GrandStaffState, ScoreLabelSize } from '@/state/types';
import { ACCEPTED_MUSIC_XML_TYPES, musicXmlFromFile } from '@/state/musicXml';
import { GrandStaff } from '@/notation/GrandStaff';
import { Button, Slider } from './ui';
import { getInstrument, semitones } from '@/music/instruments';
import { prefersFlats } from '@/music/pitch';
import { writtenKeyFifthsDelta } from '@/notation/scoreTransform';

const SIZE_OPTIONS: { value: ScoreLabelSize; label: string }[] = [
  { value: 'S', label: 'SM' }, { value: 'M', label: 'RG' }, { value: 'L', label: 'LG' }, { value: 'XL', label: 'XL' },
];

function Option({ checked, label, onChange, children }: {
  checked: boolean; label: string; onChange(value: boolean): void; children?: ReactNode;
}) {
  return (
    <label className="wc-grand-staff-option flex items-center gap-2 text-xs text-ink">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}
        className="wc-grand-staff-option-checkbox accent-[var(--color-accent)]" />
      <span className="wc-grand-staff-option-label whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}

function SizeSelect({ label, value, onChange }: { label: string; value: ScoreLabelSize; onChange(value: ScoreLabelSize): void }) {
  return (
    <select aria-label={`${label} size`} value={value} onChange={(event) => onChange(event.target.value as ScoreLabelSize)}
      className="wc-grand-staff-label-size rounded-md border border-hairline bg-surface px-1.5 py-1 text-[11px] text-ink">
      {SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function GrandStaffPanel({ meta, onMeta }: { meta: BoardMeta; onMeta(patch: Partial<BoardMeta>): void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const score = meta.grandStaff;
  const info = getInstrument(meta.instrument);
  const soundingOffset = semitones(meta.instrument, meta.horn);
  const renderOptions = useMemo(() => ({
    hideEmptyStaves: score?.hideEmptyStaves ?? false,
    showNoteNames: score?.showNoteNames ?? false,
    noteNameSize: score?.noteNameSize ?? 'XL' as const,
    showCounts: score?.showCounts ?? false,
    countSize: score?.countSize ?? 'L' as const,
    transposeSemitones: score?.transposeForInstrument ? -soundingOffset : 0,
    preferFlats: prefersFlats(soundingOffset),
    fifthsDelta: score?.transposeForInstrument ? writtenKeyFifthsDelta(soundingOffset) : 0,
  }), [score?.hideEmptyStaves, score?.showNoteNames, score?.noteNameSize, score?.showCounts, score?.countSize,
    score?.transposeForInstrument, soundingOffset]);
  const update = (patch: Partial<GrandStaffState>) => score && onMeta({ grandStaff: { ...score, ...patch } });
  const hornName = info.horns.find((horn) => horn.id === meta.horn)?.name;

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
              onChange={(scale) => update({ scale })}
              format={(value) => `${Math.round(value * 100)}%`} />
          </div>
        )}
        {score && (
          <div className="wc-grand-staff-options flex basis-full flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-3"
            role="group" aria-label="Score options">
            <Option checked={score.hideEmptyStaves ?? false} label="Hide empty staves" onChange={(hideEmptyStaves) => update({ hideEmptyStaves })} />
            <Option checked={score.showNoteNames ?? false} label="Note names" onChange={(showNoteNames) => update({ showNoteNames })}>
              {score.showNoteNames && <SizeSelect label="Note names" value={score.noteNameSize ?? 'XL'} onChange={(noteNameSize) => update({ noteNameSize })} />}
            </Option>
            <Option checked={score.showCounts ?? false} label="Count" onChange={(showCounts) => update({ showCounts })}>
              {score.showCounts && <SizeSelect label="Count" value={score.countSize ?? 'L'} onChange={(countSize) => update({ countSize })} />}
            </Option>
            <Option checked={score.transposeForInstrument ?? false}
              label={`Transpose from concert pitch${hornName ? ` for ${hornName}` : ` for ${info.shortName}`}`}
              onChange={(transposeForInstrument) => update({ transposeForInstrument })} />
          </div>
        )}
        {error && <p role="alert" className="wc-grand-staff-upload-error basis-full text-xs text-red-500">{error}</p>}
      </div>
      {score && (
        <div className="wc-grand-staff-scroll overflow-x-auto">
          <div className="wc-grand-staff-sized mx-auto min-w-0" style={{ width: `${score.scale * 100}%` }}>
            <GrandStaff musicXml={score.musicXml} font={meta.musicFont} options={renderOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
