declare module '@pepperhorn/fingering-components' {
  export interface Fingering {
    note?: string; octave?: number; label?: string; note_text?: string;
    down?: string[]; half?: string[]; ring?: string[]; optional?: string[]; trill?: string[];
    overblow?: boolean; states?: Record<string, string>;
    alternates?: Omit<Fingering, 'alternates'>[];
  }
  export interface RangeBand { low: string; high: string }
  export interface Ranges { beginner: RangeBand; intermediate: RangeBand; pro: RangeBand }
  export interface Layout {
    id: string; name: string; family: string; transpose: number;
    horn?: string; horns?: Record<string, { name: string; transpose: number; ranges?: Ranges }>;
    ranges?: Ranges; viewBox: number[];
    variants?: Record<string, unknown>; keys: unknown[];
  }
  export interface RenderOptions {
    title?: boolean; width?: number; variant?: string | string[];
    look?: 'dotted' | 'ghost'; twoTone?: 'hand'; hints?: boolean;
    orient?: 'vertical' | 'horizontal'; pitch?: 'written' | 'concert'; horn?: string;
  }
  export function renderFingering(layout: Layout, f: Fingering, opts?: RenderOptions): string;
  export function transposeFor(layout: Layout, horn?: string): number;
  export function sounding(layout: Layout, f: Fingering, opts?: { horn?: string }): { note: string; octave: number | null };
}
declare module '@pepperhorn/fingering-components/instruments/*' {
  const layout: import('@pepperhorn/fingering-components').Layout; export default layout;
}
declare module '@pepperhorn/fingering-components/fingerings/*' {
  const sheet: { instrument: string; horn?: string; pitch: 'written'; note?: string;
    fingerings: import('@pepperhorn/fingering-components').Fingering[] };
  export default sheet;
}
