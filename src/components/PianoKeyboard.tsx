import { useEffect, useRef } from 'react';
import type { RangeBands } from '@/music/instruments';
import { formatPitch, fromMidi } from '@/music/pitch';
import { bandOf, keyboardSpan, layoutKeys } from './pianoLayout';

const BAND_FILL = { beginner: 'var(--color-band-beginner)', intermediate: 'var(--color-band-intermediate)', pro: 'var(--color-band-pro)' };
const WHITE_H = 120, BLACK_H = 76, STRIP = 10;

export interface PianoKeyboardProps {
  bands: RangeBands; offset: number; playable: Set<number>; selected?: number; preferFlats: boolean;
  onSelect(writtenMidi: number): void;
}

export function PianoKeyboard({ bands, offset, playable, selected, preferFlats, onSelect }: PianoKeyboardProps) {
  // everything is laid out in *display* midi (written + offset)
  const shifted = {
    beginner: { low: bands.beginner.low + offset, high: bands.beginner.high + offset },
    intermediate: { low: bands.intermediate.low + offset, high: bands.intermediate.high + offset },
    pro: { low: bands.pro.low + offset, high: bands.pro.high + offset },
  };
  const span = keyboardSpan(shifted.pro);
  const { keys, width } = layoutKeys(span.low, span.high);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = keys.find((x) => x.midi === (selected ?? shifted.beginner.low) + (selected == null ? 0 : offset));
    if (k && scroller.current) scroller.current.scrollTo({ left: k.x - scroller.current.clientWidth / 2, behavior: 'smooth' });
  }, [selected, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderKey = (k: (typeof keys)[number]) => {
    const written = k.midi - offset;
    const band = bandOf(k.midi, shifted);
    const enabled = band !== null && playable.has(written);
    const isSel = selected === written;
    const label = formatPitch(fromMidi(k.midi, preferFlats));
    const fill = isSel ? 'var(--color-accent)' : k.black ? (enabled ? '#2a3040' : '#9aa1b2') : enabled ? '#fff' : '#eef0f5';
    return (
      <g key={k.midi} className={`wc-piano-key ${k.black ? 'wc-piano-key--black' : 'wc-piano-key--white'}${isSel ? ' is-selected' : ''}`}
        role="button" aria-label={label} aria-pressed={isSel} aria-disabled={!enabled} tabIndex={enabled ? 0 : -1}
        style={{ cursor: enabled ? 'pointer' : 'not-allowed' }}
        onClick={() => enabled && onSelect(written)}
        onKeyDown={(e) => { if (enabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(written); } }}>
        <rect x={k.x} y={STRIP} width={k.w} height={k.black ? BLACK_H : WHITE_H} rx={k.black ? 3 : 5}
          fill={fill} stroke="#cfd4e0" strokeWidth={k.black ? 0 : 1}
          style={isSel ? { filter: 'drop-shadow(0 0 6px rgb(109 93 252 / .8))' } : undefined} />
        {!k.black && k.midi % 12 === 0 && (
          <text x={k.x + k.w / 2} y={STRIP + WHITE_H - 8} textAnchor="middle" fontSize={9} fontWeight={500} fill="#667085">{label}</text>
        )}
        {band && <rect x={k.x} y={0} width={k.w} height={STRIP - 2} rx={2} fill={BAND_FILL[band]} className={`wc-piano-band wc-piano-band--${band}`} />}
      </g>
    );
  };

  return (
    <div ref={scroller} className="wc-piano overflow-x-auto">
      <svg className="wc-piano-svg block" width={width} height={WHITE_H + STRIP + 2} viewBox={`0 0 ${width} ${WHITE_H + STRIP + 2}`}>
        {keys.filter((k) => !k.black).map(renderKey)}
        {keys.filter((k) => k.black).map(renderKey)}
      </svg>
    </div>
  );
}
