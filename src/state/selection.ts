import type { BuilderDraft } from '@/components/Builder';

/**
 * What the app has selected for editing: a fingering card open in the Builder
 * (as a draft), or a text card open in its own panel. Never both.
 *
 * It is one state object with one reducer rather than two `useState` calls
 * because the mutual exclusion has to hold at a single point. It previously
 * did not: `edit()` and `addTextCard()` each remembered to clear the other
 * side, and `selectNote()` and `commit()` did not — so picking a piano note
 * while a text card was selected left both editors open and the board's
 * selection ring pointing at a card the Builder was not building. Every extra
 * path was another chance to forget. Here there is nothing to remember: the
 * invariant is re-established on every action, whatever the action was.
 */
export interface Selection {
  draft: BuilderDraft | null;
  textEditId: string | null;
}

/** The functional form exists for `selectNote`, which patches a live draft. */
export type DraftUpdate = BuilderDraft | null | ((d: BuilderDraft | null) => BuilderDraft | null);

export type SelectionAction =
  | { type: 'draft'; draft: DraftUpdate }
  | { type: 'text'; id: string }
  | { type: 'none' };

export const NO_SELECTION: Selection = { draft: null, textEditId: null };

export function selectionReducer(s: Selection, a: SelectionAction): Selection {
  switch (a.type) {
    case 'draft': {
      const draft = typeof a.draft === 'function' ? a.draft(s.draft) : a.draft;
      // A live draft owns the selection. Clearing the draft does NOT hand the
      // selection back to a text card: nothing was selected there either.
      const next: Selection = { draft, textEditId: draft ? null : s.textEditId };
      return next.draft === s.draft && next.textEditId === s.textEditId ? s : next;
    }
    case 'text':
      return s.textEditId === a.id && !s.draft ? s : { draft: null, textEditId: a.id };
    case 'none':
      return NO_SELECTION;
  }
}

/**
 * Which board card wears the selection ring. A draft with no `editingId` is a
 * NEW card that is not on the board yet, so nothing is ringed — the ring must
 * not fall through to a text card id the Builder has nothing to do with.
 */
export const selectedCardId = (s: Selection): string | undefined => s.draft?.editingId ?? s.textEditId ?? undefined;
