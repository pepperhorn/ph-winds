import type { DiagramStyle } from '@/state/types';
import { COLOR_PRESETS } from '@/state/defaults';
import { Chip, Segmented, Swatches } from './ui';

export function DiagramStyleControls({ value, variants, onChange }: { value: DiagramStyle; variants: string[]; onChange(p: Partial<DiagramStyle>): void }) {
  const toggle = (v: string) => onChange({ variants: value.variants.includes(v) ? value.variants.filter((x) => x !== v) : [...value.variants, v] });
  return (
    <div className="wc-diagram-style space-y-3">
      {variants.length > 0 && (
        <div className="wc-variant-chips flex flex-wrap gap-1.5">
          {variants.map((v) => <Chip key={v} selected={value.variants.includes(v)} onClick={() => toggle(v)}>{v}</Chip>)}
        </div>
      )}
      <div className="wc-style-row flex flex-wrap items-center gap-3 text-xs text-muted">
        <Segmented label="Look" value={value.look} onChange={(look) => onChange({ look })}
          options={[{ value: 'solid', label: 'Solid' }, { value: 'dotted', label: 'Dotted' }, { value: 'ghost', label: 'Ghost' }]} />
        <label className="wc-style-twotone flex items-center gap-1.5">
          <input type="checkbox" checked={value.twoTone} onChange={(e) => onChange({ twoTone: e.target.checked })}
            className="wc-style-twotone-checkbox" />
          <span className="wc-style-twotone-label">Two-tone hands</span>
        </label>
        <label className="wc-style-hints flex items-center gap-1.5">
          <input type="checkbox" checked={value.hints} onChange={(e) => onChange({ hints: e.target.checked })}
            className="wc-style-hints-checkbox" />
          <span className="wc-style-hints-label">Hints</span>
        </label>
      </div>
      <div className="wc-style-colors grid gap-2 text-xs text-muted">
        <div className="wc-style-color-row wc-style-color-primary flex items-center gap-3">
          <span className="wc-style-color-label w-20">Pressed</span>
          <Swatches label="Pressed colour" value={value.primary} presets={COLOR_PRESETS} onChange={(primary) => onChange({ primary })} />
        </div>
        {value.twoTone && (
          <div className="wc-style-color-row wc-style-color-secondary flex items-center gap-3">
            <span className="wc-style-color-label w-20">Right hand</span>
            <Swatches label="Right hand colour" value={value.secondary} presets={COLOR_PRESETS} onChange={(secondary) => onChange({ secondary })} />
          </div>
        )}
      </div>
    </div>
  );
}
