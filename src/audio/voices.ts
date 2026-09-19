import { type Pitch, toMidi } from '@/music/pitch';
import { getInstrument, semitones } from '@/music/instruments';

export type VoiceSpec =
  | { source: 'soundfont'; name: string }
  | { source: 'versilian'; name: string; range: [number, number]; fallback: string };

const sf = (name: string): VoiceSpec => ({ source: 'soundfont', name });
const RECORDER: VoiceSpec = {
  source: 'versilian', name: 'Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder - Sustain', range: [72, 98], fallback: 'recorder',
};
export const PIANO_VOICE = sf('acoustic_grand_piano');

const SAX: Record<string, string> = { soprano: 'soprano_sax', alto: 'alto_sax', tenor: 'tenor_sax', baritone: 'baritone_sax' };

export function instrumentVoice(id: string, horn?: string): VoiceSpec {
  switch (id) {
    case 'saxophone': return sf(SAX[horn ?? getInstrument(id).defaultHorn ?? 'alto']);
    case 'clarinet': case 'nuvo-dood': return sf('clarinet');
    case 'flute': case 'nuvo-toot': return sf('flute');
    case 'trumpet': return sf('trumpet');
    case 'trombone': return sf('trombone');
    case 'recorder': case 'tin-whistle': return RECORDER;
    default: throw new Error(`No voice for ${id}`);
  }
}

export const soundingMidi = (p: Pitch, id: string, horn?: string) => toMidi(p) + semitones(id, horn);

export const resolveVoice = (v: VoiceSpec, midi: number): VoiceSpec =>
  v.source === 'versilian' && (midi < v.range[0] || midi > v.range[1]) ? sf(v.fallback) : v;
