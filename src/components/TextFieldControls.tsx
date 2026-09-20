import type { TextField } from '@/state/types';
import { Segmented } from './ui';

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
        return <line key={y} x1={x1} y1={y} x2={x2} y2={y} />;
      })}
    </svg>
  );
}

export function TextFieldControls({ label, value, base, onChange, placeholder }:
  { label: string; value: Partial<TextField>; base: TextField; onChange(p: Partial<TextField>): void; placeholder?: string }) {
  const v = { ...base, ...value };
  return (
    <div className="wc-text-field grid grid-cols-[4.5rem_1fr] items-center gap-2">
      <label className="wc-text-field-label flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={v.show} onChange={(e) => onChange({ show: e.target.checked })} aria-label={`Show ${label}`}
          className="wc-text-field-checkbox" />{label}
      </label>
      <div className="wc-text-field-controls flex flex-wrap items-center gap-2">
        <input value={value.text ?? ''} placeholder={placeholder ?? base.text} onChange={(e) => onChange({ text: e.target.value })}
          aria-label={`${label} text`} className="wc-text-input min-w-0 flex-1 rounded-lg border border-hairline px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
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
