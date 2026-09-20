import type { BoardMeta, CardItem, TextField } from '@/state/types';
import { resolveCardText, resolveStyle } from '@/state/resolve';
import { fingeringsFor, getInstrument, type InstrumentInfo } from '@/music/instruments';
import { formatPitch, toMidi } from '@/music/pitch';
import { StaffNote } from '@/notation/StaffNote';
import { FingeringView } from './FingeringView';

export const BASE_DIAGRAM_WIDTH = 120;
export const BASE_STAFF_WIDTH = 150;

const SIZE = { heading: { S: 'text-xs', M: 'text-sm', L: 'text-lg' }, other: { S: 'text-[11px]', M: 'text-xs', L: 'text-sm' } } as const;
const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function Line({ f, kind, cls }: { f: TextField; kind: 'heading' | 'other'; cls: string }) {
  if (!f.show) return null;
  return <div className={`${cls} w-full ${SIZE[kind][f.size]} ${ALIGN[f.align]} ${kind === 'heading' ? 'font-semibold text-ink' : 'text-muted'}`}>{f.text}</div>;
}

/** Short, readable label for the "not available on …" line: horn name plus
 * instrument name when the instrument has horns (e.g. "E♭ alto Saxophone"),
 * otherwise just the instrument name. */
function unavailableLabel(info: InstrumentInfo, hornId?: string): string {
  const horn = info.horns.find((h) => h.id === hornId);
  return horn ? `${horn.name} ${info.shortName}` : info.shortName;
}

export interface WindCardProps {
  card: Pick<CardItem, 'pitch' | 'fingeringIndex' | 'display' | 'orientation' | 'scale' | 'text' | 'style'>;
  meta: BoardMeta;
  onPlay?: (which: 'voice' | 'piano') => void;
  showPlay?: 'hover' | 'always';
  loadingPlay?: 'voice' | 'piano';
  className?: string;
}

export function WindCard({ card, meta, onPlay, showPlay = 'hover', loadingPlay, className = '' }: WindCardProps) {
  const info = getInstrument(meta.instrument);
  const options = fingeringsFor(meta.instrument, meta.horn, toMidi(card.pitch));
  const unavailable = options.length === 0;

  if (unavailable) {
    return (
      <div data-orientation={card.orientation} data-display={card.display} data-export-hide
        className={`wc-card wc-card--unavailable relative flex flex-col items-center gap-1.5 rounded-2xl border border-hairline bg-surface p-4 opacity-[0.55] ${className}`}>
        <div className="wc-card-unavailable-note text-sm font-semibold text-ink">{formatPitch(card.pitch)}</div>
        <div className="wc-card-unavailable-text text-xs text-muted">not available on {unavailableLabel(info, meta.horn)}</div>
      </div>
    );
  }

  const text = resolveCardText(card, meta);
  const style = resolveStyle(card, meta);
  const fingering = options[Math.min(card.fingeringIndex, options.length - 1)];
  const dW = Math.round(BASE_DIAGRAM_WIDTH * card.scale);
  const sW = Math.round(BASE_STAFF_WIDTH * card.scale);
  const showDiagram = card.display !== 'notation';
  const showStaff = card.display !== 'fingering';
  const horizontal = card.orientation === 'horizontal';

  return (
    <div data-orientation={card.orientation} data-display={card.display}
      className={`wc-card group relative flex flex-col items-center gap-2 rounded-2xl border border-hairline bg-surface p-4 shadow-glow transition-shadow hover:shadow-glow-strong ${className}`}>
      <Line f={text.heading} kind="heading" cls="wc-card-heading" />
      <Line f={text.subtitle} kind="other" cls="wc-card-subtitle" />
      {/* [justify-content:safe_center]: defense in depth — if this box is ever narrower
          than its fixed-width diagram/staff children, fall back to start-alignment
          instead of centering, which would clip both sides equally. */}
      <div className={`wc-card-body flex items-center [justify-content:safe_center] gap-4 ${horizontal ? 'flex-row' : 'flex-col'}`}>
        {showDiagram && <FingeringView layout={info.layout} fingering={fingering} style={style} orient={meta.diagramOrient} width={dW} />}
        {showStaff && <StaffNote pitch={card.pitch} clef={info.clef} font={meta.musicFont} width={sW} />}
      </div>
      <Line f={text.footer} kind="other" cls="wc-card-footer" />
      {onPlay && (
        <div data-export-hide className={`wc-card-play absolute right-2 top-2 flex gap-1 ${showPlay === 'hover' ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : ''}`}>
          <button type="button" aria-label="Play voice" aria-busy={loadingPlay === 'voice'} onClick={() => onPlay('voice')}
            className="btn-play-voice grid size-7 place-items-center rounded-full bg-accent-soft text-accent hover:bg-accent hover:text-white">
            {loadingPlay === 'voice' ? <span className="wc-play-spinner size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : '♪'}
          </button>
          <button type="button" aria-label="Play piano" aria-busy={loadingPlay === 'piano'} onClick={() => onPlay('piano')}
            className="btn-play-piano grid size-7 place-items-center rounded-full bg-accent-soft text-accent hover:bg-accent hover:text-white">
            {loadingPlay === 'piano' ? <span className="wc-play-spinner size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : '🎹'}
          </button>
        </div>
      )}
    </div>
  );
}
