"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  HighlightExtension,
  HighlightPluginKey,
  type HighlightState,
} from "./highlightExtension";

export interface RichEditorHandle {
  /** Underlying TipTap editor (may be null before mount). */
  editor: Editor | null;
  /** Plain-text content for compliance scanning. */
  getText: () => string;
  /** HTML for persistence / export. */
  getHtml: () => string;
  /** Replace [from, to] with text, chunk-by-chunk. Returns final range. */
  streamReplace: (
    from: number,
    to: number,
    chunks: AsyncIterable<string>
  ) => Promise<{ from: number; to: number }>;
  /** Push highlight decorations. */
  setHighlights: (state: HighlightState) => void;
  /** Whether IME composition is in progress. */
  isComposing: () => boolean;
}

interface RichEditorProps {
  initialHtml: string;
  readonly?: boolean;
  onUpdate?: (html: string, text: string) => void;
  /** Called when IME composition ends and there's new content. */
  onCompositionEnd?: () => void;
  placeholder?: string;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  function RichEditor(
    { initialHtml, readonly = false, onUpdate, onCompositionEnd, placeholder },
    ref
  ) {
    const composingRef = useRef(false);
    const onUpdateRef = useRef(onUpdate);
    const onCompositionEndRef = useRef(onCompositionEnd);

    useEffect(() => {
      onUpdateRef.current = onUpdate;
    }, [onUpdate]);
    useEffect(() => {
      onCompositionEndRef.current = onCompositionEnd;
    }, [onCompositionEnd]);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          // Keep TipTap's built-in history (ProseMirror-based, handles
          // position mapping and IME correctly). Our earlier plan proposed
          // a hand-rolled ring buffer — dropped after review.
          history: { depth: 100, newGroupDelay: 500 },
        }),
        Underline,
        Placeholder.configure({
          placeholder: placeholder ?? "开始写作…",
        }),
        HighlightExtension,
      ],
      content: initialHtml || "<p></p>",
      editable: !readonly,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "prose prose-slate max-w-none min-h-[480px] focus:outline-none " +
            "prose-headings:tracking-tight prose-p:leading-8 prose-p:text-slate-800 " +
            "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
        },
        handleDOMEvents: {
          compositionstart: () => {
            composingRef.current = true;
            return false;
          },
          compositionend: () => {
            composingRef.current = false;
            // Fire onUpdate once composition closes so the full composed
            // word makes it into auto-save + compliance scan.
            queueMicrotask(() => onCompositionEndRef.current?.());
            return false;
          },
        },
      },
      onUpdate({ editor }) {
        // Skip mid-composition updates — Chinese IME fires many events per
        // pinyin keystroke. We save once at composition end instead.
        if (composingRef.current) return;
        const html = editor.getHTML();
        const text = editor.getText();
        onUpdateRef.current?.(html, text);
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        editor,
        getText: () => editor?.getText() ?? "",
        getHtml: () => editor?.getHTML() ?? "",
        isComposing: () => composingRef.current,
        setHighlights: (state) => {
          if (!editor) return;
          const view = editor.view;
          view.dispatch(view.state.tr.setMeta(HighlightPluginKey, state));
        },
        streamReplace: async (from, to, chunks) => {
          if (!editor) return { from, to };
          // Delete the original selection in a single transaction.
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .deleteSelection()
            .run();
          let cursor = from;
          for await (const chunk of chunks) {
            if (!chunk) continue;
            editor
              .chain()
              .insertContentAt(cursor, chunk)
              .setTextSelection(cursor + chunk.length)
              .run();
            cursor += chunk.length;
          }
          return { from, to: cursor };
        },
      }),
      [editor]
    );

    return (
      <div className="joto-editor rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EditorContent editor={editor} />
      </div>
    );
  }
);
