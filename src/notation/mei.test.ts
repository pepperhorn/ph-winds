import { describe, it, expect } from 'vitest';
import { buildMei } from './mei';
import { parsePitch } from '@/music/pitch';

describe('buildMei', () => {
  it('treble clef sharp', () => {
    const x = buildMei(parsePitch('F#4'), 'G');
    expect(x).toContain('clef.shape="G" clef.line="2"');
    expect(x).toContain('<note pname="f" oct="4" dur="1" accid="s"/>');
  });
  it('bass clef flat', () => {
    const x = buildMei(parsePitch('Bb2'), 'F');
    expect(x).toContain('clef.shape="F" clef.line="4"');
    expect(x).toContain('accid="f"');
  });
  it('natural has no accid', () => {
    expect(buildMei(parsePitch('C5'), 'G')).toContain('<note pname="c" oct="5" dur="1"/>');
  });
});
