import type { BoardMeta, TextKey } from '@/state/types';
import { getInstrument, listInstruments } from '@/music/instruments';
import { DiagramStyleControls } from './DiagramStyleControls';
import { TextFieldControls } from './TextFieldControls';
import { Section, Segmented } from './ui';

const CONFIRM = 'Changing instrument clears the board. Continue?';

export function BoardSettings({ meta, hasCards, onMeta, onInstrument }:
  { meta: BoardMeta; hasCards: boolean; onMeta(p: Partial<BoardMeta>): void; onInstrument(id: string, horn?: string): void }) {
  const info = getInstrument(meta.instrument);
  const change = (id: string, horn?: string) => { if (!hasCards || window.confirm(CONFIRM)) onInstrument(id, horn); };
  const setCardText = (k: TextKey, p: object) => onMeta({ cardText: { ...meta.cardText, [k]: { ...meta.cardText[k], ...p } } });

  return (
    <section className="wc-board-settings space-y-3">
      <div className="wc-board-settings-main flex flex-wrap items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-glow">
        <label className="wc-instrument-select flex items-center gap-2 text-sm">
          <span className="wc-instrument-select-label text-muted">Instrument</span>
          <select aria-label="Instrument" value={meta.instrument} onChange={(e) => change(e.target.value)}
            className="wc-instrument-select-input rounded-lg border border-hairline bg-surface px-2 py-1.5 font-medium">
            {listInstruments().map((i) => <option key={i.id} className="wc-instrument-option" value={i.id}>{i.name}</option>)}
          </select>
        </label>
        {info.horns.length > 0 && (
          <select aria-label="Horn" value={meta.horn} onChange={(e) => change(meta.instrument, e.target.value)}
            className="wc-horn-select rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm">
            {info.horns.map((h) => <option key={h.id} className="wc-horn-option" value={h.id}>{h.name}</option>)}
          </select>
        )}
        <Segmented label="Pitch" value={meta.pitchMode} onChange={(pitchMode) => onMeta({ pitchMode })}
          options={[{ value: 'written', label: 'Written' }, { value: 'concert', label: 'Concert' }]} />
        <Segmented label="Music font" value={meta.musicFont} onChange={(musicFont) => onMeta({ musicFont })}
          options={[{ value: 'bravura', label: 'Bravura' }, { value: 'petaluma', label: 'Petaluma' }]} />
        <Segmented label="Diagram" value={meta.diagramOrient} onChange={(diagramOrient) => onMeta({ diagramOrient })}
          options={[{ value: 'vertical', label: 'Upright' }, { value: 'horizontal', label: 'Sideways' }]} />
        <Segmented label="Columns" value={String(meta.columns)} onChange={(c) => onMeta({ columns: c === 'auto' ? 'auto' : Number(c) })}
          options={[{ value: 'auto', label: 'Auto' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
      </div>
      <div className="wc-board-settings-sections grid gap-3 md:grid-cols-2">
        <Section title="Diagram style">
          <DiagramStyleControls value={meta.style} variants={Object.keys(info.layout.variants ?? {})}
            onChange={(p) => onMeta({ style: { ...meta.style, ...p } })} />
        </Section>
        <Section title="Text">
          <p className="wc-board-text-heading text-xs font-medium text-ink">Board</p>
          <TextFieldControls label="Title" value={meta.title} base={meta.title} onChange={(p) => onMeta({ title: { ...meta.title, ...p } })} placeholder="Board title" />
          <TextFieldControls label="Subtitle" value={meta.subtitle} base={meta.subtitle} onChange={(p) => onMeta({ subtitle: { ...meta.subtitle, ...p } })} placeholder="Subtitle" />
          <TextFieldControls label="Footer" value={meta.footer} base={meta.footer} onChange={(p) => onMeta({ footer: { ...meta.footer, ...p } })} placeholder="Footer" />
          <p className="wc-card-defaults-heading pt-2 text-xs font-medium text-ink">Card defaults</p>
          <TextFieldControls label="Heading" value={meta.cardText.heading} base={meta.cardText.heading} onChange={(p) => setCardText('heading', p)} placeholder="Note name" />
          <TextFieldControls label="Subtitle" value={meta.cardText.subtitle} base={meta.cardText.subtitle} onChange={(p) => setCardText('subtitle', p)} placeholder="Sounding pitch" />
          <TextFieldControls label="Footer" value={meta.cardText.footer} base={meta.cardText.footer} onChange={(p) => setCardText('footer', p)} />
        </Section>
      </div>
    </section>
  );
}
