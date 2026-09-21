import type { BoardMeta, CardItem, TextCard, TextField } from '@/state/types';
import { isTextCard } from '@/state/types';
import { cardIconRenders, isTextCardBlank } from '@/state/textCards';
import { resolveTextCardText } from '@/state/resolve';
import { CardIcon } from './cardIcons';
import { WindCard } from './WindCard';

/** Width of a text card at scale 1, matching a vertical fingering card's footprint. */
export const BASE_TEXT_CARD_WIDTH = 168;
/** Icon/picture box at scale 1. */
export const BASE_TEXT_CARD_ART = 72;

const SIZE = { heading: { S: 'text-xs', M: 'text-sm', L: 'text-lg' }, other: { S: 'text-[11px]', M: 'text-xs', L: 'text-sm' } } as const;
const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function Line({ f, kind, cls }: { f: TextField; kind: 'heading' | 'other'; cls: string }) {
  if (!f.show) return null;
  return <div className={`${cls} w-full break-words ${SIZE[kind][f.size]} ${ALIGN[f.align]} ${kind === 'heading' ? 'font-semibold text-ink' : 'text-muted'}`}>{f.text}</div>;
}

/**
 * A text card: an optional picture *or* icon over the same
 * heading/subtitle/footer stack a fingering card draws, with the same
 * `TextField` size/align/show semantics.
 *
 * It is not a new layout — a text card is a card with the text and no diagram,
 * so it agrees with the fingering card beside it on type scale and chrome.
 */
export function TextCardView({ card, meta, className = '' }: { card: TextCard; meta: BoardMeta; className?: string }) {
  const text = resolveTextCardText(card, meta);
  const art = Math.round(BASE_TEXT_CARD_ART * card.scale);

  // The empty state lives HERE rather than only in the "seed a placeholder
  // heading" creation path. The card is not invisible without it — the wrapper
  // below always has a width, a border and a shadow, so a blank card draws as
  // a bare ~168×32 bar you can still click, drag and delete. It is
  // unexplained: nothing on it says it is an empty card of yours rather than a
  // card that failed to render, and nothing says what to do about it. A card
  // can end up blank by routes the seeding never sees — every slot's text
  // deleted, an icon cleared, or an import whose only art is an icon id this
  // build cannot draw — so the renderer is the one place that catches them all.
  const blank = isTextCardBlank(card);

  return (
    <div data-card-kind="text"
      style={{ width: Math.round(BASE_TEXT_CARD_WIDTH * card.scale) }}
      className={`wc-card wc-text-card group relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-hairline bg-surface p-4 shadow-glow transition-shadow hover:shadow-glow-strong ${className}`}>
      {/*
        * At most one piece of art. `applyCardPatch` already guarantees that,
        * and resolves a card carrying both the same way this does — icon
        * first — so the two layers agree on which one survives instead of
        * each quietly preferring the other.
        */}
      {card.icon && cardIconRenders(card.icon)
        ? <CardIcon className="wc-text-card-icon" id={card.icon} size={art}
            title={text.heading.show ? undefined : (text.subtitle.show ? text.subtitle.text : undefined)} />
        : card.image
          // SECURITY: `image` is a data URI that may have come off an untrusted
          // imported board, and `parseImage` admits `data:image/svg+xml`. An
          // <img> renders SVG inert — scripts, event handlers and external
          // fetches inside it never run. The same bytes in <object>, <iframe> or
          // <embed>, or injected as markup, execute. This must stay an <img>;
          // there is no "better" element for it.
          ? <img className="wc-text-card-image max-w-full rounded-lg object-contain" src={card.image}
              alt={text.heading.show ? '' : 'Card picture'} style={{ maxHeight: art, height: art }} />
          : null}
      <Line f={text.heading} kind="heading" cls="wc-text-card-heading" />
      <Line f={text.subtitle} kind="other" cls="wc-text-card-subtitle" />
      <Line f={text.footer} kind="other" cls="wc-text-card-footer" />
      {blank && (
        <p data-export-hide className="wc-text-card-placeholder rounded-lg border border-dashed border-hairline px-3 py-2 text-center text-xs italic text-muted">
          Empty text card — add a heading, an icon or a picture
        </p>
      )}
    </div>
  );
}

/**
 * One board card's contents, dispatched on `kind`. Checked first and by the
 * type guard, so a text card can never reach fingering rendering, pitch math
 * or playback — `WindCard` below this line only ever sees a `FingeringCard`.
 */
export function CardView({ card, meta, onPlay, loadingPlay }: {
  card: CardItem; meta: BoardMeta;
  onPlay?: (which: 'voice' | 'piano') => void;
  loadingPlay?: 'voice' | 'piano';
}) {
  if (isTextCard(card)) return <TextCardView card={card} meta={meta} />;
  return <WindCard card={card} meta={meta} onPlay={onPlay} loadingPlay={loadingPlay} />;
}
