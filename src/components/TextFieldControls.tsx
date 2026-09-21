import { useEffect, useId, useRef, useState } from 'react';
import type { TextField } from '@/state/types';
import { WILDCARDS } from '@/state/resolve';
import { Segmented } from './ui';

const WILDCARD_TIP = `Wildcards resolved per card: ${WILDCARDS.join(' ')}`;

/** What each token resolves to, for the popover. Keyed in WILDCARDS order. */
const WILDCARD_MEANINGS: Record<string, string> = {
  '{noteName}': 'register name, e.g. High G',
  '{transposedPitch}': 'written pitch, e.g. G5',
  '{concertPitch}': 'sounding pitch, e.g. B♭4',
};

/**
 * One ⓘ for a whole group of card-text fields. All three fields take the same
 * tokens, so a reminder under each one was the same line printed three times.
 */
export function WildcardHint({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  // A popover you can only close by hitting the same 4px ⓘ again is a trap.
  // Escape and a click outside both dismiss it, and Escape puts focus back on
  // the button it came from. Listeners only exist while it is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector('button')?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <span ref={root} className={`wc-wildcard-hint relative inline-flex ${className}`}>
      {/* `aria-controls` only while the popover exists — pointing at an id
          that is not in the DOM is a dangling reference to a screen reader. */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label="About wildcards" title={WILDCARD_TIP}
        className="btn-wildcard-hint grid size-4 place-items-center rounded-full text-[10px] leading-none text-muted transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        ⓘ
      </button>
      {open && (
        <span id={id} role="note"
          className="wc-wildcard-popover absolute left-0 top-5 z-20 w-60 rounded-xl border border-hairline bg-surface p-2.5 text-[11px] leading-snug shadow-glow">
          <span className="wc-wildcard-popover-title mb-1.5 block font-medium text-ink">Wildcards, resolved per card</span>
          {WILDCARDS.map((w) => (
            <span key={w} className="wc-wildcard-row mb-1 flex flex-col text-muted last:mb-0">
              <code className="wc-wildcard-token self-start rounded bg-canvas px-1 py-px text-ink">{w}</code>
              <span className="wc-wildcard-meaning">{WILDCARD_MEANINGS[w]}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** 16x16 align-left/center/right glyphs: three horizontal bars, rounded caps. */
function AlignIcon({ align }: { align: 'left' | 'center' | 'right' }) {
  // Each pair is [x1, x2] for one bar; widths (12, 6, 10) match across all
  // three alignments so only the horizontal anchoring differs.
  const bars = {
    left: [[2, 14], [2, 8], [2, 12]],
    center: [[2, 14], [5, 11], [3, 13]],
    right: [[2, 14], [8, 14], [4, 14]],
  }[align];
  return (
    <svg className="wc-align-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false">
      {bars.map(([x1, x2], i) => {
        const y = 4 + i * 4;
        return <line key={y} className="wc-align-icon-bar" x1={x1} y1={y} x2={x2} y2={y} />;
      })}
    </svg>
  );
}

/**
 * `wildcards` defaults to `true` because this control is a card-text control
 * in every place but one: the board's own title/subtitle/footer, which are
 * board chrome and never get wildcard substitution, opt out explicitly.
 */
export function TextFieldControls({ label, value, base, onChange, placeholder, wildcards = true }:
  { label: string; value: Partial<TextField>; base: TextField; onChange(p: Partial<TextField>): void; placeholder?: string; wildcards?: boolean }) {
  const v = { ...base, ...value };
  return (
    <div className="wc-text-field grid grid-cols-[4.5rem_1fr] items-center gap-2">
      <label className="wc-text-field-label flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={v.show} onChange={(e) => onChange({ show: e.target.checked })} aria-label={`Show ${label}`}
          className="wc-text-field-checkbox" />{label}
      </label>
      <div className="wc-text-field-controls flex flex-wrap items-center gap-2">
        <input value={value.text ?? ''} placeholder={placeholder ?? base.text} onChange={(e) => onChange({ text: e.target.value })}
          aria-label={`${label} text`} title={wildcards ? WILDCARD_TIP : undefined}
          className="wc-text-input min-w-0 flex-1 rounded-lg border border-hairline px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
        <Segmented label={`${label} size`} value={v.size} onChange={(size) => onChange({ size })}
          options={[{ value: 'S', label: 'S' }, { value: 'M', label: 'M' }, { value: 'L', label: 'L' }]} />
        <Segmented label={`${label} align`} value={v.align} onChange={(align) => onChange({ align })}
          options={[
            { value: 'left', label: <AlignIcon align="left" />, ariaLabel: 'Left align' },
            { value: 'center', label: <AlignIcon align="center" />, ariaLabel: 'Center align' },
            { value: 'right', label: <AlignIcon align="right" />, ariaLabel: 'Right align' },
          ]} />
      </div>
    </div>
  );
}
