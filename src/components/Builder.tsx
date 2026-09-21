import type { ReactNode } from 'react';
import type { BoardMeta, CardDraft, TextKey } from '@/state/types';
import { autoHeading, autoSubtitle } from '@/state/resolve';
import { fingeringsFor, getInstrument, listInstruments, semitones, type InstrumentId } from '@/music/instruments';
import { toMidi } from '@/music/pitch';
import { resolveStyle } from '@/state/resolve';
import { WindCard } from './WindCard';
import { FingeringView } from './FingeringView';
import { TextFieldControls } from './TextFieldControls';
import { Button, onRovingKeyDown, rovingTabIndex, Segmented, Slider } from './ui';
import { INSTRUMENT_ICONS } from './instrumentIcons';

export interface BuilderDraft extends CardDraft { editingId?: string }

/** Thin, tall silhouettes (flute, clarinet, tin whistle, Nuvo Dood/TooT,
 * recorder) render as near-invisible hairlines upright in a square tile;
 * rotated 45° they use the tile's diagonal and are actually legible. */
const THIN_SILHOUETTES = new Set<InstrumentId>(['flute', 'clarinet', 'tin-whistle', 'nuvo-dood', 'nuvo-toot', 'recorder']);

export function Builder({ draft, meta, onChange, onCommit, onCancelEdit, onPlay, loadingPlay, onMeta, onInstrument, pianoPanel }: {
  draft: BuilderDraft | null; meta: BoardMeta;
  onChange(d: BuilderDraft): void; onCommit(): void; onCancelEdit(): void; onPlay(which: 'voice' | 'piano'): void;
  loadingPlay?: 'voice' | 'piano';
  onMeta(p: Partial<BoardMeta>): void; onInstrument(id: string, horn?: string): void;
  pianoPanel?: ReactNode;
}) {
  const set = (p: Partial<BuilderDraft>) => draft && onChange({ ...draft, ...p });
  const options = draft ? fingeringsFor(meta.instrument, meta.horn, toMidi(draft.pitch)) : [];
  const unavailable = !!draft && options.length === 0;
  const info = getInstrument(meta.instrument);
  const layout = info.layout;
  const semis = semitones(meta.instrument, meta.horn);
  const setText = (k: TextKey, p: object) => draft && set({ text: { ...draft.text, [k]: { ...draft.text?.[k], ...p } } });
  const instrumentIds = listInstruments().map((i) => i.id);

  return (
    <section className="wc-builder space-y-6 rounded-3xl border border-hairline bg-surface/80 p-6 shadow-glow backdrop-blur">
      <div className="wc-builder-settings-main flex flex-col gap-3 rounded-2xl border border-hairline bg-canvas p-4"
        role="group" aria-label="Board settings">
        <div className="wc-settings-group wc-settings-group-instrument flex flex-col items-center gap-1">
        <div role="radiogroup" aria-label="Instrument" className="wc-instrument-picker flex flex-wrap justify-center gap-2">
          {listInstruments().map((i) => {
            const selected = meta.instrument === i.id;
            // These silhouettes are thin verticals that read as near-invisible
            // hairlines upright; rotating the artwork 45° puts them on the
            // diagonal of the square tile, where they're actually legible.
            const thin = THIN_SILHOUETTES.has(i.id);
            return (
              <button key={i.id} type="button" role="radio" aria-checked={selected} aria-label={i.name} title={i.name}
                tabIndex={rovingTabIndex(i.id, instrumentIds, meta.instrument as InstrumentId)}
                onClick={() => onInstrument(i.id)}
                onKeyDown={onRovingKeyDown(instrumentIds, meta.instrument as InstrumentId, (id) => onInstrument(id))}
                className={`wc-instrument-icon btn-instrument-icon group flex w-18 flex-col items-center gap-1 rounded-2xl p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  selected ? 'bg-accent-soft ring-2 ring-accent shadow-glow' : 'hover:bg-surface'
                }`}>
                <span className="wc-instrument-icon-tile flex size-16 items-center justify-center overflow-hidden">
                  <img src={INSTRUMENT_ICONS[i.id].src} width={INSTRUMENT_ICONS[i.id].width} height={INSTRUMENT_ICONS[i.id].height} alt=""
                    className={`wc-instrument-icon-img h-full w-full object-contain p-1 transition ${thin ? 'rotate-45' : ''} ${
                      selected ? 'opacity-100' : 'opacity-50 grayscale group-hover:opacity-80'
                    }`} />
                </span>
                <span aria-hidden="true" className={`wc-instrument-icon-label text-[10px] leading-tight ${selected ? 'font-medium text-accent' : 'text-muted'}`}>
                  {i.shortName}
                </span>
              </button>
            );
          })}
        </div>
        </div>
        <div className="wc-builder-settings-row flex flex-wrap items-center gap-3">
          {info.horns.length > 0 && (
            <div className="wc-settings-group flex flex-col items-start gap-1" role="group" aria-labelledby="wc-settings-caption-horn">
              <span id="wc-settings-caption-horn" className="wc-settings-caption text-[11px] text-muted">Horn:</span>
              <select aria-label="Horn" value={meta.horn ?? ''} onChange={(e) => onInstrument(meta.instrument, e.target.value)}
                className="wc-horn-select rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm">
                {info.horns.map((h) => <option key={h.id} className="wc-horn-option" value={h.id}>{h.name}</option>)}
              </select>
            </div>
          )}
          <div className="wc-settings-group flex flex-col items-start gap-1" role="group" aria-labelledby="wc-settings-caption-pitch">
            <span id="wc-settings-caption-pitch" className="wc-settings-caption text-[11px] text-muted">Written as:</span>
            <Segmented label="Written as:" value={meta.pitchMode} onChange={(pitchMode) => onMeta({ pitchMode })}
              options={[{ value: 'written', label: 'Played' }, { value: 'concert', label: 'Concert Pitch (Piano)' }]} />
          </div>
          <div className="wc-settings-group flex flex-col items-start gap-1" role="group" aria-labelledby="wc-settings-caption-font">
            <span id="wc-settings-caption-font" className="wc-settings-caption text-[11px] text-muted">Notation:</span>
            <Segmented label="Notation:" value={meta.musicFont} onChange={(musicFont) => onMeta({ musicFont })}
              options={[{ value: 'bravura', label: 'Standard' }, { value: 'petaluma', label: 'Handwritten' }]} />
          </div>
          <div className="wc-settings-group flex flex-col items-start gap-1" role="group" aria-labelledby="wc-settings-caption-orient">
            <span id="wc-settings-caption-orient" className="wc-settings-caption text-[11px] text-muted">Orientation:</span>
            <Segmented label="Orientation:" value={meta.diagramOrient} onChange={(diagramOrient) => onMeta({ diagramOrient })}
              options={[{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }]} />
          </div>
          <div className="wc-settings-group flex flex-col items-start gap-1" role="group" aria-labelledby="wc-settings-caption-columns">
            <span id="wc-settings-caption-columns" className="wc-settings-caption text-[11px] text-muted">Cards per Row:</span>
            <Segmented label="Cards per Row:" value={String(meta.columns)} onChange={(c) => onMeta({ columns: c === 'auto' ? 'auto' : Number(c) })}
              options={[{ value: 'auto', label: 'Auto' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
          </div>
        </div>
      </div>
      <div className="wc-builder-grid grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="wc-builder-preview grid min-h-64 place-items-center gap-2 rounded-2xl bg-canvas p-4">
        {draft
          ? <>
              <WindCard card={draft} meta={meta} onPlay={onPlay} showPlay="always" loadingPlay={loadingPlay} />
              {unavailable && (
                <p id="builder-unavailable-hint" className="wc-builder-unavailable-hint text-xs text-muted">Pick another note — this one isn't available on {info.shortName}.</p>
              )}
            </>
          : <p className="wc-builder-empty text-sm text-muted">Pick a note on the keyboard below</p>}
      </div>
      <div className="wc-builder-controls space-y-4">
        <div className="wc-builder-row flex flex-wrap gap-3">
          <Segmented label="Display" value={draft?.display ?? 'both'} onChange={(display) => set({ display })}
            options={[{ value: 'fingering', label: 'Fingering' }, { value: 'both', label: 'Both' }, { value: 'notation', label: 'Notation' }]} />
          <Segmented label="Card layout" value={draft?.orientation ?? 'vertical'} onChange={(orientation) => set({ orientation })}
            options={[{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }]} />
        </div>
        <Slider label="Scale" value={draft?.scale ?? 1} min={0.5} max={2} step={0.1} onChange={(scale) => set({ scale })}
          format={(v) => `${Math.round(v * 100)}%`} />
        {options.length > 1 && (
          <div role="radiogroup" aria-label="Fingerings" className="wc-alternates flex flex-wrap gap-2">
            {options.map((f, i) => {
              const indices = options.map((_, j) => j);
              const current = draft?.fingeringIndex ?? 0;
              return (
              <button key={i} type="button" role="radio" aria-checked={current === i} aria-label={`Fingering ${i + 1}`}
                tabIndex={rovingTabIndex(i, indices, current)}
                onClick={() => set({ fingeringIndex: i })}
                onKeyDown={onRovingKeyDown(indices, current, (idx) => set({ fingeringIndex: idx }))}
                className={`wc-alternate btn-alternate rounded-xl border p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${current === i ? 'border-accent shadow-glow-strong' : 'border-hairline hover:shadow-glow'}`}>
                <FingeringView layout={layout} fingering={f} style={resolveStyle(draft ?? {}, meta)} orient={meta.diagramOrient} width={44} />
              </button>
              );
            })}
          </div>
        )}
        <div className="wc-builder-text space-y-2">
          <TextFieldControls label="Heading" value={draft?.text?.heading ?? {}} base={meta.cardText.heading}
            placeholder={draft ? autoHeading(draft.pitch) : ''} onChange={(p) => setText('heading', p)} />
          <TextFieldControls label="Subtitle" value={draft?.text?.subtitle ?? {}} base={meta.cardText.subtitle}
            placeholder={draft ? autoSubtitle(draft.pitch, semis) : ''} onChange={(p) => setText('subtitle', p)} />
          <TextFieldControls label="Footer" value={draft?.text?.footer ?? {}} base={meta.cardText.footer} onChange={(p) => setText('footer', p)} />
        </div>
        <div className="wc-builder-actions flex items-center gap-3">
          <Button variant="filled" disabled={!draft || unavailable} onClick={onCommit} className="btn-add-card"
            aria-describedby={unavailable ? 'builder-unavailable-hint' : undefined}>
            {draft?.editingId ? 'Update card' : 'Add to board'}
          </Button>
          {draft?.editingId && <Button variant="text" onClick={onCancelEdit} className="btn-cancel-edit">Cancel</Button>}
        </div>
      </div>
      </div>
      {pianoPanel && <div className="wc-builder-piano">{pianoPanel}</div>}
    </section>
  );
}
