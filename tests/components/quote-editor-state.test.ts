import { describe, expect, it } from "vitest";

import {
  editorReducer,
  loadEditorState,
  type EditorState,
} from "@/components/quotes/quote-form/use-quote-editor";
import { QUOTE_LINES_MAX } from "@/lib/domain/quote";
import type { QuoteLineErrors, QuoteLineFormValues } from "@/lib/domain/quote-form";
import type { QuoteFormState } from "@/lib/quotes/types";

function lineValues(description: string): QuoteLineFormValues {
  return { description, quantity: "1", unit_price: "10", vat_rate: "21" };
}

function serverState(
  lines: QuoteLineFormValues[],
  lineErrors: QuoteLineErrors[] = lines.map(() => ({})),
): QuoteFormState {
  return {
    fieldErrors: {},
    lineErrors,
    formError: null,
    values: {
      client_id: "c1",
      issue_date: "2026-11-27",
      valid_until: "",
      irpf_rate: "0",
      notes: "",
      lines,
    },
  };
}

function stateWithLines(...descriptions: string[]): EditorState {
  return loadEditorState(serverState(descriptions.map(lineValues)), null);
}

describe("editorReducer: add_line", () => {
  it("añade una línea vacía con IVA 21 y una key nueva", () => {
    const state = stateWithLines("A");
    const next = editorReducer(state, { type: "add_line" });

    expect(next.lines).toHaveLength(2);
    expect(next.lines[1]).toEqual({
      key: "line-1",
      values: { description: "", quantity: "", unit_price: "", vat_rate: "21" },
      errors: {},
    });
    expect(next.nextKey).toBe(2);
    expect(next.lines[0]).toBe(state.lines[0]);
  });

  it(`no pasa de ${QUOTE_LINES_MAX} líneas`, () => {
    const full = stateWithLines(...Array.from({ length: QUOTE_LINES_MAX }, (_, i) => `L${i}`));
    expect(full.lines).toHaveLength(QUOTE_LINES_MAX);

    const next = editorReducer(full, { type: "add_line" });
    expect(next).toBe(full);
  });

  it("con una línea menos del máximo, sí añade", () => {
    const almost = stateWithLines(
      ...Array.from({ length: QUOTE_LINES_MAX - 1 }, (_, i) => `L${i}`),
    );
    expect(editorReducer(almost, { type: "add_line" }).lines).toHaveLength(QUOTE_LINES_MAX);
  });
});

describe("editorReducer: remove_line", () => {
  it("al quitar la del medio, las demás conservan valores, keys y errores", () => {
    const state = loadEditorState(
      serverState(
        [lineValues("A"), lineValues("B"), lineValues("C")],
        [{ quantity: ["Error A"] }, {}, { line: ["Error C"] }],
      ),
      null,
    );
    const next = editorReducer(state, { type: "remove_line", key: "line-1" });

    expect(next.lines).toEqual([
      { key: "line-0", values: lineValues("A"), errors: { quantity: ["Error A"] } },
      { key: "line-2", values: lineValues("C"), errors: { line: ["Error C"] } },
    ]);
    expect(next.nextKey).toBe(3);
  });

  it("no quita la última línea", () => {
    const state = stateWithLines("A");
    expect(editorReducer(state, { type: "remove_line", key: "line-0" })).toBe(state);
  });

  it("una key inexistente no cambia las líneas", () => {
    const state = stateWithLines("A", "B");
    expect(editorReducer(state, { type: "remove_line", key: "line-99" }).lines).toEqual(
      state.lines,
    );
  });
});

describe("editorReducer: cambios de campos", () => {
  it("set_header cambia solo ese campo de cabecera", () => {
    const state = stateWithLines("A");
    const next = editorReducer(state, { type: "set_header", field: "notes", value: "Hola" });

    expect(next.header).toEqual({ ...state.header, notes: "Hola" });
    expect(next.lines).toBe(state.lines);
  });

  it("set_line cambia solo ese campo de esa línea", () => {
    const state = stateWithLines("A", "B");
    const next = editorReducer(state, {
      type: "set_line",
      key: "line-1",
      field: "unit_price",
      value: "12,50",
    });

    expect(next.lines[0]).toBe(state.lines[0]);
    expect(next.lines[1]).toEqual({
      key: "line-1",
      values: { ...lineValues("B"), unit_price: "12,50" },
      errors: {},
    });
  });
});

describe("loadEditorState", () => {
  it("sin estado previo, numera las keys desde line-0", () => {
    const state = stateWithLines("A", "B");
    expect(state.lines.map((line) => line.key)).toEqual(["line-0", "line-1"]);
    expect(state.nextKey).toBe(2);
    expect(state.header.client_id).toBe("c1");
  });

  it("deja los errores de lineErrors[i] en la línea i", () => {
    const state = loadEditorState(
      serverState(
        [lineValues("A"), lineValues("B")],
        [{}, { description: ["Falta la descripción."] }],
      ),
      null,
    );
    expect(state.lines[0]?.errors).toEqual({});
    expect(state.lines[1]?.errors).toEqual({ description: ["Falta la descripción."] });
  });

  it("si faltan lineErrors para una línea, la deja sin errores", () => {
    const state = loadEditorState(serverState([lineValues("A"), lineValues("B")], []), null);
    expect(state.lines.map((line) => line.errors)).toEqual([{}, {}]);
  });

  it("reutiliza las keys previas por posición y crea nuevas para las sobrantes", () => {
    const previous = stateWithLines("A");
    const loaded = loadEditorState(serverState([lineValues("X"), lineValues("Y")]), previous);

    expect(loaded.lines.map((line) => line.key)).toEqual(["line-0", "line-1"]);
    expect(loaded.lines.map((line) => line.values.description)).toEqual(["X", "Y"]);
    expect(loaded.nextKey).toBe(2);
  });

  it("nextKey nunca retrocede ni repite keys tras varias cargas y quitadas", () => {
    let state = stateWithLines("A", "B", "C");

    state = editorReducer(state, { type: "remove_line", key: "line-0" });
    state = editorReducer(state, { type: "remove_line", key: "line-1" });
    expect(state.lines.map((line) => line.key)).toEqual(["line-2"]);

    state = editorReducer(state, {
      type: "load",
      state: serverState([lineValues("A"), lineValues("B"), lineValues("C")]),
    });
    expect(state.lines.map((line) => line.key)).toEqual(["line-2", "line-3", "line-4"]);
    expect(state.nextKey).toBe(5);

    state = editorReducer(state, { type: "load", state: serverState([lineValues("A")]) });
    expect(state.lines.map((line) => line.key)).toEqual(["line-2"]);
    expect(state.nextKey).toBe(5);

    state = editorReducer(state, { type: "add_line" });
    expect(state.lines.map((line) => line.key)).toEqual(["line-2", "line-5"]);
    expect(state.nextKey).toBe(6);
  });

  it("con values.lines vacío, crea una línea vacía", () => {
    const state = loadEditorState(serverState([], []), null);
    expect(state.lines).toEqual([
      {
        key: "line-0",
        values: { description: "", quantity: "", unit_price: "", vat_rate: "21" },
        errors: {},
      },
    ]);
    expect(state.nextKey).toBe(1);
  });

  it("al cargar un estado vacío sobre uno previo, conserva la primera key", () => {
    const previous = stateWithLines("A", "B");
    const state = loadEditorState(serverState([], []), previous);
    expect(state.lines.map((line) => line.key)).toEqual(["line-0"]);
    expect(state.nextKey).toBe(2);
  });

  it("copia los valores para no compartir objetos con el estado del servidor", () => {
    const server = serverState([lineValues("A")]);
    const state = loadEditorState(server, null);
    expect(state.lines[0]?.values).toEqual(server.values.lines[0]);
    expect(state.lines[0]?.values).not.toBe(server.values.lines[0]);
  });
});
