import { useReducer, useState } from "react";
import { QUOTE_LINES_MAX } from "@/lib/domain/quote";
import {
  emptyQuoteLineValues,
  type QuoteFormValues,
  type QuoteHeaderField,
  type QuoteLineErrors,
  type QuoteLineField,
  type QuoteLineFormValues,
} from "@/lib/domain/quote-form";
import type { QuoteFormState } from "@/lib/quotes/types";

export type HeaderValues = Omit<QuoteFormValues, "lines">;

export type EditorLine = {
  key: string;
  values: QuoteLineFormValues;
  errors: QuoteLineErrors;
};

export type EditorState = {
  header: HeaderValues;
  lines: EditorLine[];
  nextKey: number;
};

export type EditorAction =
  | { type: "load"; state: QuoteFormState }
  | { type: "set_header"; field: QuoteHeaderField; value: string }
  | { type: "set_line"; key: string; field: QuoteLineField; value: string }
  | { type: "add_line" }
  | { type: "remove_line"; key: string };

export function lineKey(index: number): string {
  return `line-${index}`;
}

export function loadEditorState(state: QuoteFormState, previous: EditorState | null): EditorState {
  const { lines: lineValues, ...header } = state.values;
  const sourceLines = lineValues.length > 0 ? lineValues : [emptyQuoteLineValues()];
  let nextKey = previous?.nextKey ?? 0;

  const lines = sourceLines.map((values, index) => {
    const key = previous?.lines[index]?.key ?? lineKey(nextKey++);
    return { key, values: { ...values }, errors: state.lineErrors[index] ?? {} };
  });

  return { header: { ...header }, lines, nextKey };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return loadEditorState(action.state, state);
    case "set_header":
      return { ...state, header: { ...state.header, [action.field]: action.value } };
    case "set_line":
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.key === action.key
            ? { ...line, values: { ...line.values, [action.field]: action.value } }
            : line,
        ),
      };
    case "add_line":
      if (state.lines.length >= QUOTE_LINES_MAX) return state;
      return {
        ...state,
        lines: [
          ...state.lines,
          { key: lineKey(state.nextKey), values: emptyQuoteLineValues(), errors: {} },
        ],
        nextKey: state.nextKey + 1,
      };
    case "remove_line":
      if (state.lines.length <= 1) return state;
      return { ...state, lines: state.lines.filter((line) => line.key !== action.key) };
  }
}

export function useQuoteEditor(initialState: QuoteFormState, serverState: QuoteFormState) {
  const [editor, dispatch] = useReducer(editorReducer, initialState, (initial) =>
    loadEditorState(initial, null),
  );

  const [loadedState, setLoadedState] = useState(serverState);
  if (serverState !== loadedState) {
    setLoadedState(serverState);
    dispatch({ type: "load", state: serverState });
  }

  function setHeader(field: QuoteHeaderField, value: string) {
    dispatch({ type: "set_header", field, value });
  }

  function setLine(key: string, field: QuoteLineField, value: string) {
    dispatch({ type: "set_line", key, field, value });
  }

  function addLine(): string {
    const key = lineKey(editor.nextKey);
    dispatch({ type: "add_line" });
    return key;
  }

  function removeLine(key: string) {
    dispatch({ type: "remove_line", key });
  }

  return { editor, setHeader, setLine, addLine, removeLine };
}
