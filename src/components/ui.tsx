import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function Segmented<T extends string>({ value, options, onChange, className = '', label }:
  { value: T; options: { value: T; label: string }[]; onChange(v: T): void; className?: string; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={`wc-segmented inline-flex rounded-full border border-hairline bg-canvas p-0.5 ${className}`}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`wc-segmented-option rounded-full px-3 py-1 text-xs font-medium transition ${value === o.value ? 'bg-surface text-accent shadow-glow' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={`wc-chip rounded-full border px-3 py-1 text-xs font-medium transition ${selected ? 'border-accent bg-accent-soft text-accent' : 'border-hairline bg-surface text-muted hover:text-ink'}`}>
      {children}
    </button>
  );
}

export function Slider({ value, min, max, step, onChange, label, format = String }:
  { value: number; min: number; max: number; step: number; onChange(v: number): void; label: string; format?: (v: number) => string }) {
  return (
    <label className="wc-slider flex items-center gap-3 text-xs text-muted">
      <span className="wc-slider-label w-12">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="wc-slider-input flex-1 accent-[var(--color-accent)]" />
      <span className="wc-slider-value w-10 text-right font-medium text-ink">{format(value)}</span>
    </label>
  );
}

export function Swatches({ value, presets, onChange, label }: { value: string; presets: string[]; onChange(v: string): void; label: string }) {
  return (
    <div className="wc-swatches flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {presets.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onChange(c)}
          className={`wc-swatch size-6 rounded-full border-2 ${value === c ? 'border-accent ring-2 ring-accent/30' : 'border-white shadow'}`} style={{ background: c }} />
      ))}
      <input type="color" aria-label={`${label} custom`} value={value} onChange={(e) => onChange(e.target.value)} className="wc-swatch-custom size-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
    </div>
  );
}

export function Button({ variant = 'tonal', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'filled' | 'tonal' | 'text' }) {
  const v = {
    filled: 'bg-accent text-white shadow-glow hover:shadow-glow-strong disabled:opacity-40 disabled:shadow-none',
    tonal: 'bg-accent-soft text-accent hover:bg-accent/15 disabled:opacity-40',
    text: 'text-accent hover:bg-accent-soft disabled:opacity-40',
  }[variant];
  return <button type="button" className={`btn btn-${variant} rounded-full px-4 py-2 text-sm font-medium transition ${v} ${className}`} {...rest} />;
}

export function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="wc-section rounded-xl border border-hairline bg-surface">
      <button type="button" title={title} aria-expanded={open} onClick={() => setOpen(!open)}
        className="wc-section-toggle flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-ink">
        {title}<span aria-hidden="true" className="wc-section-caret text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="wc-section-body space-y-3 border-t border-hairline px-4 py-3">{children}</div>}
    </div>
  );
}
