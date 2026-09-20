import type { TextField } from '@/state/types';
import { Segmented } from './ui';

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
          options={[{ value: 'left', label: '⟸' }, { value: 'center', label: '≡' }, { value: 'right', label: '⟹' }]} />
      </div>
    </div>
  );
}
