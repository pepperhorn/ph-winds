import { describe, it, expect } from 'vitest';
import { instrumentVoice, PIANO_VOICE, soundingMidi, resolveVoice } from './voices';
import { parsePitch } from '@/music/pitch';

const RECORDER = 'Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder - Sustain';

describe('voices', () => {
  it('maps every instrument', () => {
    expect(instrumentVoice('saxophone', 'soprano')).toEqual({ source: 'soundfont', name: 'soprano_sax' });
    expect(instrumentVoice('saxophone', 'alto')).toEqual({ source: 'soundfont', name: 'alto_sax' });
    expect(instrumentVoice('saxophone', 'tenor')).toEqual({ source: 'soundfont', name: 'tenor_sax' });
    expect(instrumentVoice('saxophone', 'baritone')).toEqual({ source: 'soundfont', name: 'baritone_sax' });
    expect(instrumentVoice('saxophone')).toEqual({ source: 'soundfont', name: 'alto_sax' });
    expect(instrumentVoice('clarinet')).toEqual({ source: 'soundfont', name: 'clarinet' });
    expect(instrumentVoice('flute')).toEqual({ source: 'soundfont', name: 'flute' });
    expect(instrumentVoice('trumpet')).toEqual({ source: 'soundfont', name: 'trumpet' });
    expect(instrumentVoice('trombone')).toEqual({ source: 'soundfont', name: 'trombone' });
    expect(instrumentVoice('nuvo-dood')).toEqual({ source: 'soundfont', name: 'clarinet' });
    expect(instrumentVoice('nuvo-toot')).toEqual({ source: 'soundfont', name: 'flute' });
    for (const id of ['recorder', 'tin-whistle'])
      expect(instrumentVoice(id)).toEqual({ source: 'versilian', name: RECORDER, range: [72, 98], fallback: 'recorder' });
    expect(PIANO_VOICE).toEqual({ source: 'soundfont', name: 'acoustic_grand_piano' });
  });
  it('sounds concert pitch', () => {
    expect(soundingMidi(parsePitch('C5'), 'saxophone', 'alto')).toBe(63);
    expect(soundingMidi(parsePitch('C4'), 'recorder')).toBe(72);
    expect(soundingMidi(parsePitch('C5'), 'flute')).toBe(72);
  });
  it('falls back outside the VCSL sample range', () => {
    const v = instrumentVoice('tin-whistle', 'Bb');
    expect(resolveVoice(v, 70)).toEqual({ source: 'soundfont', name: 'recorder' });
    expect(resolveVoice(v, 74)).toBe(v);
  });
});
