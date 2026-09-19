import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindBoard } from '@/state/useWindBoard';
import { localStorageAdapter } from '@/state/storage';
import { newCardDraft, createBoard } from '@/state/defaults';
import { exportBoardJson, importBoardJson } from '@/state/io';
import type { CardItem } from '@/state/types';
import { playableMidis, rangeBands, semitones, spellWritten } from '@/music/instruments';
import { prefersFlats, toMidi, type Pitch } from '@/music/pitch';
import { instrumentVoice, PIANO_VOICE, soundingMidi } from '@/audio/voices';
import { playNote, releaseVoicesExcept } from '@/audio/playback';
import { prefetchVerovioWhenIdle } from '@/notation/verovio';
import { exportBoardImage, downloadText } from '@/export/image';
import { AppBar } from '@/components/AppBar';
import { AboutDialog } from '@/components/AboutDialog';
import { Board } from '@/components/Board';
import { BoardSettings } from '@/components/BoardSettings';
import { Builder, type BuilderDraft } from '@/components/Builder';
import { PianoDrawer } from '@/components/PianoDrawer';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { useToast } from '@/components/Toast';

const readPref = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const writePref = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export default function WindCardsApp() {
  const { toast, node: toastNode } = useToast();
  const storage = useMemo(
    () => localStorageAdapter('ph-winds-board', { onError: () => toast('Could not save — browser storage is full') }),
    [toast],
  );
  const board = useWindBoard({ storage });
  const { state } = board;
  const { meta } = state;
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [pianoOpen, setPianoOpen] = useState(() => readPref('ph-winds-piano-open', true));
  const [soundOnClick, setSoundOnClick] = useState(() => readPref('ph-winds-sound-on-click', true));
  const [soundVoice, setSoundVoice] = useState<'voice' | 'piano'>(() => readPref('ph-winds-sound-voice', 'voice'));
  const [about, setAbout] = useState(false);

  useEffect(() => writePref('ph-winds-piano-open', pianoOpen), [pianoOpen]);
  useEffect(() => writePref('ph-winds-sound-on-click', soundOnClick), [soundOnClick]);
  useEffect(() => writePref('ph-winds-sound-voice', soundVoice), [soundVoice]);
  useEffect(() => prefetchVerovioWhenIdle(), []);
  useEffect(() => { releaseVoicesExcept([instrumentVoice(meta.instrument, meta.horn), PIANO_VOICE]); }, [meta.instrument, meta.horn]);

  const semis = semitones(meta.instrument, meta.horn);
  const bands = useMemo(() => rangeBands(meta.instrument, meta.horn), [meta.instrument, meta.horn]);
  const playable = useMemo(() => playableMidis(meta.instrument, meta.horn), [meta.instrument, meta.horn]);

  const play = useCallback((pitch: Pitch, which: 'voice' | 'piano') => {
    const voice = which === 'piano' ? PIANO_VOICE : instrumentVoice(meta.instrument, meta.horn);
    playNote(voice, soundingMidi(pitch, meta.instrument, meta.horn)).catch(() => toast('Could not load that sound'));
  }, [meta.instrument, meta.horn, toast]);

  const selectNote = (writtenMidi: number) => {
    const pitch = spellWritten(meta.instrument, meta.horn, writtenMidi);
    setDraft((d) => (d ? { ...d, pitch, fingeringIndex: 0 } : newCardDraft(pitch)));
    if (soundOnClick) play(pitch, soundVoice);
  };

  const commit = () => {
    if (!draft) return;
    const { editingId, ...card } = draft;
    if (editingId) board.updateCard(editingId, card); else board.addCard(card);
    setDraft(editingId ? null : { ...card, text: undefined });
  };

  const edit = (id: string) => {
    const c = state.items.find((x) => x.id === id);
    if (c) { const { id: _id, ...rest } = c; setDraft({ ...rest, editingId: id }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const onImport = async (f: File) => {
    const r = importBoardJson(await f.text());
    if (r.ok) { board.replaceState(r.state); setDraft(null); } else toast(r.error);
  };

  const onNew = () => {
    if (state.items.length && !window.confirm('Start a new board? This clears the current one.')) return;
    const b = createBoard(meta.instrument);
    board.replaceState({ ...b, meta: { ...b.meta, horn: meta.horn } });
    setDraft(null);
  };

  const exportImage = (kind: 'png' | 'pdf') =>
    exportBoardImage(document.getElementById('wc-board-export')!, kind, meta.title.text || 'ph-winds-board').catch(() => toast('Export failed'));

  return (
    <div className={`wc-app min-h-screen ${pianoOpen ? 'pb-72' : 'pb-16'}`}>
      <AppBar onNew={onNew} onImport={onImport} onAbout={() => setAbout(true)}
        onExportJson={() => downloadText(exportBoardJson(state), `${meta.title.text || 'ph-winds-board'}.json`, 'application/json')}
        onExportPng={() => exportImage('png')} onExportPdf={() => exportImage('pdf')} />
      <main className="wc-main mx-auto max-w-[1200px] space-y-6 px-6">
        <Builder draft={draft} meta={meta} onChange={setDraft} onCommit={commit} onCancelEdit={() => setDraft(null)}
          onPlay={(w) => draft && play(draft.pitch, w)} />
        <BoardSettings meta={meta} hasCards={state.items.length > 0} onMeta={board.setMeta}
          onInstrument={(id, horn) => { board.setInstrument(id, horn); setDraft(null); }} />
        <Board state={state} selectedId={draft?.editingId} onReorder={board.reorder} onEdit={edit}
          onDuplicate={board.duplicateCard} onRemove={board.removeCard} onMeta={board.setMeta}
          onPlay={(c: CardItem, w) => play(c.pitch, w)} />
      </main>
      <PianoDrawer open={pianoOpen} onToggle={() => setPianoOpen(!pianoOpen)}
        soundOnClick={soundOnClick} onSoundOnClick={setSoundOnClick} soundVoice={soundVoice} onSoundVoice={setSoundVoice}>
        <PianoKeyboard bands={bands} offset={meta.pitchMode === 'concert' ? semis : 0} playable={playable}
          selected={draft ? toMidi(draft.pitch) : undefined} preferFlats={meta.pitchMode === 'concert' && prefersFlats(semis)}
          onSelect={selectNote} />
      </PianoDrawer>
      <AboutDialog open={about} onClose={() => setAbout(false)} />
      {toastNode}
    </div>
  );
}
