import type { BoardMeta, TextKey } from '@/state/types';
import { getInstrument } from '@/music/instruments';
import { DiagramStyleControls } from './DiagramStyleControls';
import { TextFieldControls } from './TextFieldControls';
import { Section } from './ui';

export function BoardSettings({ meta, onMeta }: { meta: BoardMeta; onMeta(p: Partial<BoardMeta>): void }) {
  const info = getInstrument(meta.instrument);
  const setCardText = (k: TextKey, p: object) => onMeta({ cardText: { ...meta.cardText, [k]: { ...meta.cardText[k], ...p } } });

  return (
    <section className="wc-board-settings space-y-3">
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
