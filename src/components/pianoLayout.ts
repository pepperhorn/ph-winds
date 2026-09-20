import type { Band, RangeBands } from '@/music/instruments';
import { isBlackKey } from '@/music/pitch';

export interface KeyGeom { midi: number; black: boolean; x: number; w: number }

export function keyboardSpan(pro: Band, margin = 2) {
  const low = Math.floor((pro.low - margin) / 12) * 12;
  const high = Math.ceil((pro.high + margin + 1) / 12) * 12 - 1;
  return { low, high };
}

export function layoutKeys(low: number, high: number, whiteW = 22) {
  const keys: KeyGeom[] = [];
  let x = 0;
  for (let m = low; m <= high; m++) {
    if (isBlackKey(m)) keys.push({ midi: m, black: true, x: x - whiteW * 0.3, w: whiteW * 0.6 });
    else { keys.push({ midi: m, black: false, x, w: whiteW }); x += whiteW; }
  }
  return { keys, width: x };
}

export function bandOf(midi: number, b: RangeBands): 'beginner' | 'intermediate' | 'pro' | null {
  for (const k of ['beginner', 'intermediate', 'pro'] as const) if (midi >= b[k].low && midi <= b[k].high) return k;
  return null;
}
