import type { VoiceSpec } from './voices';
import { resolveVoice } from './voices';

type Player = { start(o: { note: number; duration?: number; velocity?: number }): unknown; stop(): void; ready: Promise<unknown> };

let ctx: AudioContext | null = null;
const players = new Map<string, Promise<Player>>();
const loaded = new Set<string>();
let last: Player | null = null;

const keyOf = (v: VoiceSpec) => `${v.source}:${v.name}`;
const context = () => (ctx ??= new AudioContext());

function load(v: VoiceSpec): Promise<Player> {
  const key = keyOf(v);
  let p = players.get(key);
  if (!p) {
    p = import('smplr').then(async (m) => {
      const player = (v.source === 'soundfont'
        ? m.Soundfont(context(), { instrument: v.name, kit: 'FluidR3_GM' })
        : m.Versilian(context(), { instrument: v.name })) as unknown as Player;
      await player.ready;
      loaded.add(key);
      return player;
    });
    p.catch(() => players.delete(key));
    players.set(key, p);
  }
  return p;
}

export const isVoiceLoaded = (v: VoiceSpec) => loaded.has(keyOf(v));

export async function playNote(voice: VoiceSpec, midi: number): Promise<void> {
  await context().resume();
  let v = resolveVoice(voice, midi);
  let player: Player;
  try { player = await load(v); }
  catch (e) {
    if (v.source !== 'versilian') throw e;
    v = { source: 'soundfont', name: v.fallback };
    player = await load(v);
  }
  last?.stop();
  player.start({ note: midi, duration: 1.5, velocity: 90 });
  last = player;
}

/** Drop players for voices the board no longer uses (e.g. after an instrument change). */
export function releaseVoicesExcept(keep: VoiceSpec[]) {
  const want = new Set(keep.map(keyOf));
  for (const k of [...players.keys()]) if (!want.has(k) && !k.startsWith('soundfont:recorder')) { players.delete(k); loaded.delete(k); }
}
