import { useMemo, type CSSProperties } from 'react';
import { renderFingering, type Fingering, type Layout } from '@pepperhorn/fingering-components';
import type { DiagramStyle } from '@/state/types';

export function FingeringView({ layout, fingering, style, orient, width }:
  { layout: Layout; fingering: Fingering; style: DiagramStyle; orient: 'vertical' | 'horizontal'; width: number }) {
  const svg = useMemo(() => renderFingering(layout, fingering, {
    title: false, width,
    variant: style.variants,
    look: style.look === 'solid' ? undefined : style.look,
    twoTone: style.twoTone ? 'hand' : undefined,
    hints: style.hints,
    orient,
  }), [layout, fingering, style, orient, width]);
  const vars = { '--fc-ink': style.primary, '--fc-ink-2': style.secondary, '--fc-font': 'Poppins, sans-serif' } as CSSProperties;
  return <div className="wc-fingering [&_svg]:h-auto [&_svg]:w-full" style={{ ...vars, width }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
