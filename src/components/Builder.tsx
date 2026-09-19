import type { BoardMeta, CardDraft, TextKey } from '@/state/types';
import { autoHeading, autoSubtitle } from '@/state/resolve';
import { fingeringsFor, getInstrument, semitones } from '@/music/instruments';
import { toMidi } from '@/music/pitch';
import { resolveStyle } from '@/state/resolve';
import { WindCard } from './WindCard';
import { FingeringView } from './FingeringView';
import { TextFieldControls } from './TextFieldControls';
import { Button, Segmented, Slider } from './ui';

export interface BuilderDraft extends CardDraft { editingId?: string }

export function Builder({ draft, meta, onChange, onCommit, onCancelEdit, onPlay }: {
  draft: BuilderDraft | null; meta: BoardMeta;
  onChange(d: BuilderDraft): void; onCommit(): void; onCancelEdit(): void; onPlay(which: 'voice' | 'piano'): void;
}) {
  const set = (p: Partial<BuilderDraft>) => draft && onChange({ ...draft, ...p });
  const options = draft ? fingeringsFor(meta.instrument, meta.horn, toMidi(draft.pitch)) : [];
  const layout = getInstrument(meta.instrument).layout;
  const semis = semitones(meta.instrument, meta.horn);
  const setText = (k: TextKey, p: object) => draft && set({ text: { ...draft.text, [k]: { ...draft.text?.[k], ...p } } });

  return (
    <section className="wc-builder grid gap-6 rounded-3xl border border-hairline bg-surface/80 p-6 shadow-glow backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="wc-builder-preview grid min-h-64 place-items-center rounded-2xl bg-canvas p-4">
        {draft
          ? <WindCard card={draft} meta={meta} onPlay={onPlay} showPlay="always" />
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
            {options.map((f, i) => (
              <button key={i} type="button" role="radio" aria-checked={draft?.fingeringIndex === i} aria-label={`Fingering ${i + 1}`}
                onClick={() => set({ fingeringIndex: i })}
                className={`wc-alternate rounded-xl border p-1.5 transition ${draft?.fingeringIndex === i ? 'border-accent shadow-glow-strong' : 'border-hairline hover:shadow-glow'}`}>
                <FingeringView layout={layout} fingering={f} style={resolveStyle(draft ?? {}, meta)} orient={meta.diagramOrient} width={44} />
              </button>
            ))}
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
          <Button variant="filled" disabled={!draft} onClick={onCommit} className="btn-add-card">
            {draft?.editingId ? 'Update card' : 'Add to board'}
          </Button>
          {draft?.editingId && <Button variant="text" onClick={onCancelEdit} className="btn-cancel-edit">Cancel</Button>}
        </div>
      </div>
    </section>
  );
}
