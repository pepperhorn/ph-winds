declare module '@pepperhorn/fingering-components' {
  export interface Fingering {
    note?: string; octave?: number; label?: string; note_text?: string;
    down?: string[]; half?: string[]; ring?: string[]; optional?: string[]; trill?: string[];
    overblow?: boolean; states?: Record<string, string>;
    alternates?: Omit<Fingering, 'alternates'>[];
  }
  export interface RangeBand { low: string; high: string }
  export interface Ranges { beginner: RangeBand; intermediate: RangeBand; pro: RangeBand }
  /**
   * One half-open register band, keyed on **written** pitch: it runs from
   * `from` up to (not including) the next band's `from`, and the last band
   * runs to the top of the instrument. The first band's `from` is the
   * instrument's lowest written note.
   */
  // `name` is one of "Low" | "Middle" | "High" | "Altissimo" today, but stays
  // `string`: TypeScript resolves these instrument JSON files directly (they
  // widen to `string`), so a union here fails to assign.
  export interface Register { from: string; name: string }
  export interface Layout {
    id: string; name: string; family: string; transpose: number;
    horn?: string;
    // Tin whistle declares `registers` per horn (each key has its own written
    // range) rather than at instrument level; everything else declares them once.
    horns?: Record<string, { name: string; transpose: number; ranges?: Ranges; registers?: Register[] }>;
    ranges?: Ranges; registers?: Register[]; viewBox: number[];
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
