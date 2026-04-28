import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Compliance highlight extension.
 *
 * Renders transient inline decorations for limit words (red underline) and
 * sensitive-topic keywords (amber underline). Decorations are NOT stored in
 * the document — they're computed from the current doc text plus the ranges
 * supplied by the caller. This means:
 *   - Export HTML doesn't carry compliance markers
 *   - Highlights auto-disappear when text changes (caller re-runs scan)
 *   - TipTap history is untouched (undo works as expected)
 *
 * Ranges use plain-text character offsets against the doc's textBetween(0, size).
 * That matches what `scanLimitWords` / `scanSensitive` produce on the server.
 */

export interface HighlightRange {
  start: number;
  length: number;
  label?: string;
}

export interface HighlightState {
  limitWords: HighlightRange[];
  sensitive: HighlightRange[];
}

const EMPTY: HighlightState = { limitWords: [], sensitive: [] };

export const HighlightPluginKey = new PluginKey<HighlightState>(
  "joto-compliance-highlight"
);

export const HighlightExtension = Extension.create({
  name: "jotoComplianceHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<HighlightState>({
        key: HighlightPluginKey,
        state: {
          init: (): HighlightState => EMPTY,
          apply(tr, prev): HighlightState {
            const meta = tr.getMeta(HighlightPluginKey) as
              | HighlightState
              | undefined;
            if (meta) return meta;
            // If doc changed, clear stale highlights — caller will re-scan.
            if (tr.docChanged) return EMPTY;
            return prev;
          },
        },
        props: {
          decorations(state) {
            const hs = HighlightPluginKey.getState(state) ?? EMPTY;
            if (hs.limitWords.length === 0 && hs.sensitive.length === 0) {
              return DecorationSet.empty;
            }
            const decorations: Decoration[] = [];
            // ProseMirror positions are 1-indexed at doc start, and each
            // block boundary consumes a position. We walk text nodes and
            // maintain a plain-text cursor that matches textBetween(0,size).
            const docText = state.doc.textBetween(
              0,
              state.doc.content.size,
              "\n",
              "\n"
            );
            const add = (range: HighlightRange, cls: string) => {
              const deco = textRangeToDoc(state.doc, docText, range);
              if (!deco) return;
              decorations.push(
                Decoration.inline(deco.from, deco.to, { class: cls })
              );
            };
            for (const r of hs.limitWords) add(r, "joto-hl-limit");
            for (const r of hs.sensitive) add(r, "joto-hl-sensitive");
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/**
 * Map a plain-text range (from textBetween walking) back to doc positions.
 * Returns null if out of bounds.
 *
 * Exported for unit testing against a synthetic ProseMirror doc.
 */
export function textRangeToDoc(
  doc: import("@tiptap/pm/model").Node,
  flatText: string,
  range: HighlightRange
): { from: number; to: number } | null {
  if (range.start < 0 || range.length <= 0) return null;
  if (range.start + range.length > flatText.length) return null;

  // Walk doc nodes, maintain (plainIdx, pmPos) pairs.
  let plainIdx = 0;
  let from = -1;
  let to = -1;
  const targetStart = range.start;
  const targetEnd = range.start + range.length;

  doc.descendants((node, pos) => {
    if (from !== -1 && to !== -1) return false;
    if (node.isText) {
      const len = node.text?.length ?? 0;
      const nodeEndPlain = plainIdx + len;
      if (from === -1 && targetStart < nodeEndPlain) {
        from = pos + (targetStart - plainIdx);
      }
      if (to === -1 && targetEnd <= nodeEndPlain) {
        to = pos + (targetEnd - plainIdx);
      }
      plainIdx = nodeEndPlain;
      return false;
    }
    if (node.isBlock && plainIdx > 0) {
      // textBetween with "\n" block-sep inserts one newline between blocks
      plainIdx += 1;
    }
    return true;
  });

  if (from === -1 || to === -1 || to <= from) return null;
  return { from, to };
}

export function setHighlights(
  view: import("@tiptap/pm/view").EditorView,
  state: HighlightState
): void {
  view.dispatch(view.state.tr.setMeta(HighlightPluginKey, state));
}
