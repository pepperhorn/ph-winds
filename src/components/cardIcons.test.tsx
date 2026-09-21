import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import { CardIcon, CARD_ICONS, CARD_ICON_PREFIXES, isCardIconId } from './cardIcons';

/**
 * The glyphs are path data typed into a source file, so the defect that
 * actually happens is a truncated or mistyped `d` — a card that silently draws
 * nothing. These tests are mostly about proving every id still draws ink.
 */
describe('card icons', () => {
  it('draws something for every id in the set', () => {
    expect(CARD_ICONS.length).toBeGreaterThan(0);
    for (const def of CARD_ICONS) {
      const { container } = render(<CardIcon id={def.id} />);
      const svg = container.querySelector('svg');
      expect(svg, `${def.id} rendered no svg`).toBeTruthy();
      expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24');

      const paths = Array.from(svg!.querySelectorAll('path'));
      expect(paths.length, `${def.id} has no shapes`).toBeGreaterThan(0);
      for (const p of paths) {
        const d = p.getAttribute('d') ?? '';
        // A path that does not start with a moveto draws nothing at all, and
        // "NaN"/"undefined" is what a botched coordinate looks like.
        expect(d.startsWith('M'), `${def.id} has a path that starts "${d.slice(0, 8)}"`).toBe(true);
        expect(d.length, `${def.id} has a stub path`).toBeGreaterThan(8);
        expect(d).not.toMatch(/NaN|undefined|null/);
      }
    }
  });

  it('gives every icon a unique, prefixed id and a label', () => {
    const ids = CARD_ICONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of CARD_ICONS) {
      expect(CARD_ICON_PREFIXES.some((p) => def.id.startsWith(p)), def.id).toBe(true);
      // The prefix is the category, so a picker can group on either one.
      expect(def.id.startsWith(`${def.category}:`)).toBe(true);
      expect(def.label.trim().length).toBeGreaterThan(0);
      expect(isCardIconId(def.id)).toBe(true);
    }
  });

  it('carries the wind-specific glyphs and none of chordl’s wrong instruments', () => {
    const ids = CARD_ICONS.map((d) => d.id);
    for (const id of ['obj:saxophone', 'obj:clarinet', 'obj:reed', 'obj:musicStand']) {
      expect(ids, `${id} missing`).toContain(id);
    }
    // Guitar and piano came over from chordl's board and do not belong here.
    expect(ids).not.toContain('obj:guitar');
    expect(ids).not.toContain('obj:piano');
    // All 11 Bravura-derived music glyphs survived the port.
    expect(ids.filter((id) => id.startsWith('music:'))).toHaveLength(11);
  });

  it('renders nothing for an unknown id instead of throwing', () => {
    // A restored board is untrusted: a stale id, a bogus one, and junk.
    for (const id of ['music:noSuchGlyph', 'obj:', 'obj:guitar', 'lucide:guitar', '', 'trebleClef']) {
      const { container } = render(<CardIcon id={id} />);
      expect(container.firstChild, `${id} should render null`).toBeNull();
    }
  });

  it('accepts a well-formed id it cannot yet draw, and rejects non-ids', () => {
    // Forward compatibility: an id from a newer build round-trips through
    // storage rather than being dropped, even though nothing renders here yet.
    expect(isCardIconId('music:notInventedYet')).toBe(true);
    expect(isCardIconId('obj:notInventedYet')).toBe(true);
    expect(isCardIconId('')).toBe(false);
    expect(isCardIconId('trebleClef')).toBe(false);
    expect(isCardIconId('evil:x')).toBe(false);
    expect(isCardIconId(42)).toBe(false);
    expect(isCardIconId(null)).toBe(false);
    expect(isCardIconId(undefined)).toBe(false);
    expect(isCardIconId({ id: 'music:sharp' })).toBe(false);
  });

  it('names the glyph when given a title, and hides it when not', () => {
    const titled = render(<CardIcon id="music:trebleClef" title="Treble clef" />);
    const named = within(titled.container).getByRole('img', { name: 'Treble clef' });
    expect(named.querySelector('title')?.textContent).toBe('Treble clef');
    expect(named.getAttribute('aria-hidden')).toBeNull();

    const bare = render(<CardIcon id="music:trebleClef" />);
    const svg = bare.container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.querySelector('title')).toBeNull();
  });

  it('applies size and colour, and defaults to 32px of currentColor', () => {
    const { container } = render(<CardIcon id="obj:saxophone" size={48} color="#ff0000" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('height')).toBe('48');
    // A stroke glyph carries the colour on stroke, a music glyph on fill.
    expect(svg.getAttribute('stroke')).toBe('#ff0000');
    expect(svg.getAttribute('fill')).toBe('none');
    const music = render(<CardIcon id="music:sharp" color="#ff0000" />).container.querySelector('svg')!;
    expect(music.getAttribute('fill')).toBe('#ff0000');

    const dflt = render(<CardIcon id="music:sharp" />).container.querySelector('svg')!;
    expect(dflt.getAttribute('width')).toBe('32');
    expect(dflt.getAttribute('height')).toBe('32');
    expect(dflt.getAttribute('fill')).toBe('currentColor');
  });

  it('keeps a contextual class and merges the caller’s', () => {
    const { container } = render(<CardIcon id="obj:reed" className="wc-card-icon-slot" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('class')).toBe('wc-card-icon wc-card-icon--obj wc-card-icon-slot');
  });
});
