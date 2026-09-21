import { useRef } from 'react';
import type { BoardMeta, CardPatch, TextCard, TextKey } from '@/state/types';
import { ACCEPTED_IMAGE_TYPES } from '@/state/image';
import { CARD_ICONS, CardIcon } from './cardIcons';
import { TextFieldControls } from './TextFieldControls';
import { Button, Slider } from './ui';

const GROUP_LABELS: Record<'music' | 'obj', string> = { music: 'Notation', obj: 'Objects' };

/**
 * The icon grid. Clicking the already-selected icon CLEARS it — that is the
 * only route back to a card with neither an icon nor a picture, so the
 * affordance is spelled out in the button's own tooltip.
 */
function IconPicker({ value, onPick }: { value?: string; onPick(id: string | undefined): void }) {
  return (
    <div className="wc-icon-picker flex flex-col gap-3" role="group" aria-label="Icon">
      {(['music', 'obj'] as const).map((category) => (
        <div key={category} className={`wc-icon-group wc-icon-group--${category}`}>
          <p className="wc-icon-group-label mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{GROUP_LABELS[category]}</p>
          <div className="wc-icon-grid flex flex-wrap gap-1.5">
            {CARD_ICONS.filter((def) => def.category === category).map((def) => {
              const selected = value === def.id;
              return (
                <button key={def.id} type="button" data-icon-id={def.id} aria-pressed={selected}
                  title={selected ? `${def.label} (click to clear)` : def.label}
                  onClick={() => onPick(selected ? undefined : def.id)}
                  className={`wc-icon-option btn-icon-option grid size-9 place-items-center rounded-lg border transition ${
                    selected ? 'border-accent bg-accent-soft text-accent shadow-glow' : 'border-hairline bg-surface text-ink hover:bg-canvas'
                  }`}>
                  <CardIcon id={def.id} size={22} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Add-and-edit affordance for text cards, sitting between the fingering
 * builder and the board.
 *
 * Purely presentational: picking an icon or a picture only reports the
 * intent. The icon/picture mutual exclusion is NOT enforced here — it lives in
 * `applyCardPatch`, the one place every card mutation passes through, so no
 * handler in this file has to remember it.
 */
export function TextCardPanel({ card, meta, onAdd, onChange, onPickImage, onDone, imageError }: {
  card: TextCard | null; meta: BoardMeta;
  onAdd(): void;
  onChange(patch: CardPatch): void;
  onPickImage(file: File | null): void;
  onDone(): void;
  imageError?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const setText = (k: TextKey, p: object) => card && onChange({ text: { ...card.text, [k]: { ...card.text?.[k], ...p } } });

  return (
    <section className="wc-text-card-panel space-y-4 rounded-2xl border border-hairline bg-surface p-4 shadow-glow">
      <div className="wc-text-card-panel-head flex flex-wrap items-center justify-between gap-3">
        <p className="wc-text-card-panel-title text-sm font-medium text-ink">Text cards</p>
        <Button variant="tonal" className="btn-add-text-card" onClick={onAdd}>+ Add text card</Button>
      </div>

      {!card
        ? <p className="wc-text-card-panel-empty text-xs text-muted">A text card holds a heading, a subtitle and a footer, plus one icon or picture. Add one, or pick <em>Edit</em> on a text card already on the board.</p>
        : (
          <div className="wc-text-card-editor space-y-4 border-t border-hairline pt-4">
            <div className="wc-text-card-fields space-y-2">
              {/* Card text, same controls a fingering card gets. Wildcards such as
                  {'{noteName}'} resolve against a card's pitch, and a text card has
                  none, so they stay literal here. */}
              <TextFieldControls label="Heading" value={card.text?.heading ?? {}} base={meta.cardText.heading} onChange={(p) => setText('heading', p)} />
              <TextFieldControls label="Subtitle" value={card.text?.subtitle ?? {}} base={meta.cardText.subtitle} onChange={(p) => setText('subtitle', p)} />
              <TextFieldControls label="Footer" value={card.text?.footer ?? {}} base={meta.cardText.footer} onChange={(p) => setText('footer', p)} />
            </div>

            <Slider label="Scale" value={card.scale} min={0.5} max={2} step={0.1}
              onChange={(scale) => onChange({ scale })} format={(v) => `${Math.round(v * 100)}%`} />

            <IconPicker value={card.icon} onPick={(icon) => onChange({ icon })} />

            <div className="wc-picture-controls space-y-2" role="group" aria-label="Picture">
              <p className="wc-picture-label text-[10px] font-semibold uppercase tracking-wider text-muted">Picture</p>
              <div className="wc-picture-row flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} aria-label="Card picture"
                  className="wc-picture-input hidden"
                  onChange={(e) => {
                    onPickImage(e.target.files?.[0] ?? null);
                    // Picking the same file twice in a row fires no change
                    // event otherwise, so a rejected upload could not be
                    // retried without choosing something else first.
                    e.target.value = '';
                  }} />
                <Button variant="tonal" className="btn-pick-picture" onClick={() => fileRef.current?.click()}>
                  {card.image ? 'Replace picture…' : 'Choose a picture…'}
                </Button>
                {card.image && <Button variant="text" className="btn-remove-picture" onClick={() => onChange({ image: undefined })}>Remove</Button>}
                {card.image && <img src={card.image} alt="Card picture" className="wc-picture-preview h-10 w-auto rounded-md border border-hairline" />}
              </div>
              {imageError && (
                // Shown verbatim: these messages are written for the person who
                // picked the file, and rewording them turns them into jargon.
                <p role="alert" className="wc-picture-error text-xs leading-snug text-red-500">{imageError}</p>
              )}
            </div>

            <Button variant="filled" className="btn-text-card-done" onClick={onDone}>Done</Button>
          </div>
        )}
    </section>
  );
}
