import type { Pitch } from '@/music/pitch';

export function buildMei(p: Pitch, clef: 'G' | 'F'): string {
  const [shape, line] = clef === 'G' ? ['G', 2] : ['F', 4];
  const accid = p.alter === 1 ? ' accid="s"' : p.alter === -1 ? ' accid="f"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0"><music><body><mdiv><score>
<scoreDef><staffGrp><staffDef n="1" lines="5" clef.shape="${shape}" clef.line="${line}"/></staffGrp></scoreDef>
<section><measure n="1" right="invis"><staff n="1"><layer n="1">
<note pname="${p.step.toLowerCase()}" oct="${p.octave}" dur="1"${accid}/>
</layer></staff></measure></section></score></mdiv></body></music></mei>`;
}
