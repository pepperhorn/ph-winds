import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWindBoard } from '@/state/useWindBoard';
import { localStorageAdapter } from '@/state/storage';
import { newCardDraft, createBoard } from '@/state/defaults';
import { exportBoardJson, importBoardJson } from '@/state/io';
import type { CardItem } from '@/state/types';
import { isTextCard } from '@/state/types';
import { boardImageChars, IMAGE_BUDGET_CHARS } from '@/state/textCards';
import { fileToCardImage } from '@/state/image';
import { getInstrument, playableMidis, rangeBands, semitones, spellWritten as spellWrittenPitch } from '@/music/instruments';
import { prefersFlats, toMidi, type Pitch } from '@/music/pitch';
import { instrumentVoice, PIANO_VOICE, soundingMidi } from '@/audio/voices';
import { playNote, releaseVoicesExcept } from '@/audio/playback';
import { musicFontToVerovioFont, prefetchVerovioWhenIdle } from '@/notation/verovio';
import { exportBoardImage, downloadText } from '@/export/image';
import { ErrorBoundary } from './ErrorBoundary';
import { AppBar } from '@/components/AppBar';
import { AboutDialog } from '@/components/AboutDialog';
import { Board } from '@/components/Board';
import { BoardSettings } from '@/components/BoardSettings';
import { Builder, type BuilderDraft } from '@/components/Builder';
import { TextCardPanel } from '@/components/TextCardPanel';
import { PianoPanel } from '@/components/PianoPanel';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { useToast } from '@/components/Toast';

const readPref = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const writePref = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

function WindCardsApp() {
  const { toast, node: toastNode } = useToast();
  const storage = useMemo(
    () => localStorageAdapter('ph-winds-board', { onError: () => toast('Could not save — browser storage is full') }),
    [toast],
  );
  const board = useWindBoard({ storage });
  const { state } = board;
  const { meta } = state;
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [loading, setLoading] = useState<{ key: string; which: 'voice' | 'piano' } | null>(null);
  const [pianoOpen, setPianoOpen] = useState(() => readPref('ph-winds-piano-open', true));
  const [soundOnClick, setSoundOnClick] = useState(() => readPref('ph-winds-sound-on-click', true));
  const [soundVoice, setSoundVoice] = useState<'voice' | 'piano'>(() => readPref('ph-winds-sound-voice', 'voice'));
  const [about, setAbout] = useState(false);
  // The selected text card, edited in its own panel: the Builder is a
  // fingering builder and a text card has nothing for it to build.
  const [textEditId, setTextEditId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => writePref('ph-winds-piano-open', pianoOpen), [pianoOpen]);
  useEffect(() => writePref('ph-winds-sound-on-click', soundOnClick), [soundOnClick]);
  useEffect(() => writePref('ph-winds-sound-voice', soundVoice), [soundVoice]);
  // Pass the board's current default font so the idle warm-up pre-registers
  // the font the board will actually render with first, not just the toolkit.
  useEffect(() => prefetchVerovioWhenIdle(musicFontToVerovioFont(meta.musicFont)), [meta.musicFont]);
  useEffect(() => { releaseVoicesExcept([instrumentVoice(meta.instrument, meta.horn), PIANO_VOICE]); }, [meta.instrument, meta.horn]);

  const semis = semitones(meta.instrument, meta.horn);
  const bands = useMemo(() => rangeBands(meta.instrument, meta.horn), [meta.instrument, meta.horn]);
  const playable = useMemo(() => playableMidis(meta.instrument, meta.horn), [meta.instrument, meta.horn]);

  const play = useCallback((pitch: Pitch, which: 'voice' | 'piano', key: string) => {
    const voice = which === 'piano' ? PIANO_VOICE : instrumentVoice(meta.instrument, meta.horn);
    setLoading({ key, which });
    playNote(voice, soundingMidi(pitch, meta.instrument, meta.horn))
      .catch(() => toast('Could not load that sound'))
      .finally(() => setLoading(null));
  }, [meta.instrument, meta.horn, toast]);

  const selectNote = (writtenMidi: number) => {
    const pitch = spellWrittenPitch(meta.instrument, meta.horn, writtenMidi);
    setDraft((d) => (d ? { ...d, pitch, fingeringIndex: 0 } : newCardDraft(pitch)));
    if (soundOnClick) play(pitch, soundVoice, 'draft');
  };

  const commit = () => {
    if (!draft) return;
    const { editingId, ...card } = draft;
    if (editingId) board.updateCard(editingId, card); else board.addCard(card);
    setDraft(editingId ? null : { ...card, text: undefined });
  };

  const edit = (id: string) => {
    const c = state.items.find((x) => x.id === id);
    if (!c) return;
    if (isTextCard(c)) { setDraft(null); setTextEditId(id); setImageError(null); }
    else { const { id: _id, ...rest } = c; setTextEditId(null); setDraft({ ...rest, editingId: id }); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const textCard = textEditId ? state.items.find((c) => c.id === textEditId) : undefined;
  const selectedTextCard = textCard && isTextCard(textCard) ? textCard : null;

  const addTextCard = () => { setDraft(null); setImageError(null); setTextEditId(board.addTextCard()); };

  /**
   * Read a picked file into a stored data URI, then charge it against the
   * board-wide picture budget. The card being edited is excluded from the
   * tally so replacing its existing picture is not charged twice.
   */
  const pickImage = async (f: File | null) => {
    if (!selectedTextCard) return;
    setImageError(null);
    try {
      const dataUri = await fileToCardImage(f);
      const used = boardImageChars(state.items, selectedTextCard.id);
      if (used + dataUri.length > IMAGE_BUDGET_CHARS) {
        setImageError('There is not enough room left on this board for another picture. Remove a picture from another card, or start a new board, and try again.');
        return;
      }
      board.updateCard(selectedTextCard.id, { image: dataUri });
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'That picture could not be added.');
    }
  };

  const onImport = async (f: File) => {
    const r = importBoardJson(await f.text());
    if (r.ok) { board.replaceState(r.state); setDraft(null); setTextEditId(null); } else toast(r.error);
  };

  // Mirrors boardReducer's `setInstrument` remap so a card mid-edit in the
  // builder doesn't drift out of sync with its (already remapped) board item.
  const onInstrument = (id: string, horn?: string) => {
    const resolvedHorn = horn ?? getInstrument(id).defaultHorn;
    const oldSemis = semis;
    const newSemis = semitones(id, resolvedHorn);
    board.setInstrument(id, horn);
    setDraft((d) => (d
      ? { ...d, pitch: spellWrittenPitch(id, resolvedHorn, toMidi(d.pitch) + oldSemis - newSemis), fingeringIndex: 0 }
      : d));
  };

  const onNew = () => {
    if (state.items.length && !window.confirm('Start a new board? This clears the current one.')) return;
    const b = createBoard(meta.instrument);
    board.replaceState({ ...b, meta: { ...b.meta, horn: meta.horn } });
    setDraft(null);
    setTextEditId(null);
  };

  const exportImage = (kind: 'png' | 'pdf') =>
    exportBoardImage(document.getElementById('wc-board-export')!, kind, meta.title.text || 'ph-winds-board').catch(() => toast('Export failed'));

  const pianoPanel = (
    <PianoPanel open={pianoOpen} onToggle={() => setPianoOpen(!pianoOpen)}
      soundOnClick={soundOnClick} onSoundOnClick={setSoundOnClick} soundVoice={soundVoice} onSoundVoice={setSoundVoice}>
      <PianoKeyboard bands={bands} offset={meta.pitchMode === 'concert' ? semis : 0} playable={playable}
        selected={draft ? toMidi(draft.pitch) : undefined} preferFlats={meta.pitchMode === 'concert' && prefersFlats(semis)}
        mode={meta.pitchMode} spellWritten={(m) => spellWrittenPitch(meta.instrument, meta.horn, m)}
        onSelect={selectNote} />
    </PianoPanel>
  );

  return (
    <div className="wc-app min-h-screen">
      <AppBar onNew={onNew} onImport={onImport} onAbout={() => setAbout(true)}
        onExportJson={() => downloadText(exportBoardJson(state), `${meta.title.text || 'ph-winds-board'}.json`, 'application/json')}
        onExportPng={() => exportImage('png')} onExportPdf={() => exportImage('pdf')} />
      <main className="wc-main mx-auto max-w-[1200px] space-y-6 px-6 pb-10">
        <Builder draft={draft} meta={meta} onChange={setDraft} onCommit={commit} onCancelEdit={() => setDraft(null)}
          onPlay={(w) => draft && play(draft.pitch, w, 'draft')}
          loadingPlay={loading?.key === 'draft' ? loading.which : undefined}
          onMeta={board.setMeta} onInstrument={onInstrument} pianoPanel={pianoPanel} />
        <TextCardPanel card={selectedTextCard} meta={meta} onAdd={addTextCard} onDone={() => setTextEditId(null)}
          onChange={(patch) => selectedTextCard && board.updateCard(selectedTextCard.id, patch)}
          onPickImage={pickImage} imageError={imageError} />
        <BoardSettings meta={meta} onMeta={board.setMeta} />
        <Board state={state} selectedId={draft?.editingId ?? textEditId ?? undefined} onReorder={board.reorder} onEdit={edit}
          onDuplicate={board.duplicateCard} onRemove={board.removeCard} onMeta={board.setMeta}
          onPlay={(c: CardItem, w) => { if (!isTextCard(c)) play(c.pitch, w, c.id); }} loading={loading} />
      </main>
      <AboutDialog open={about} onClose={() => setAbout(false)} />
      {toastNode}
    </div>
  );
}

export default function WindCardsAppWithBoundary() {
  return (
    <ErrorBoundary>
      <WindCardsApp />
    </ErrorBoundary>
  );
}
