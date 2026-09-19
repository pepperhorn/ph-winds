import { describe, it, expect } from 'vitest';
import sax from '@pepperhorn/fingering-components/instruments/saxophone';
import { renderFingering } from '@pepperhorn/fingering-components';

describe('scaffold', () => {
  it('resolves fingering-components with ranges', () => {
    expect(sax.ranges?.pro.low).toBe('Bb3');
    expect(renderFingering(sax, { label: 't', down: ['lh1'] })).toContain('<svg');
  });
});
