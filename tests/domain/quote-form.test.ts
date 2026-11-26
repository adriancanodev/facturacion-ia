import { describe, expect, it } from "vitest";

import { quoteFormDataToInput, quoteInputSchema } from "@/lib/domain/quote";
import {
  DEFAULT_VAT_RATE,
  emptyQuoteFormValues,
  emptyQuoteLineValues,
  groupQuoteIssues,
  hundredthsToCompactText,
  hundredthsToFixedText,
  numericToHundredths,
  quoteFormDataToValues,
  storedQuoteToFormValues,
  type StoredQuote,
} from "@/lib/domain/quote-form";

const CLIENT_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function formDataFrom(entries: Array<[string, string]>): FormData {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
}

describe("valores vacíos", () => {
  it("una línea vacía lleva IVA 21 % por defecto", () => {
    expect(DEFAULT_VAT_RATE).toBe(21);
    expect(emptyQuoteLineValues()).toEqual({
      description: "",
      quantity: "",
      unit_price: "",
      vat_rate: "21",
    });
  });

  it("el formulario vacío empieza con una línea y sin IRPF", () => {
    const values = emptyQuoteFormValues();
    expect(values.lines).toHaveLength(1);
    expect(values.irpf_rate).toBe("0");
    expect(values.client_id).toBe("");
  });

  it("cada llamada devuelve objetos nuevos (no se comparten entre formularios)", () => {
    const a = emptyQuoteFormValues();
    const b = emptyQuoteFormValues();
    a.lines[0].description = "cambiada";
    expect(b.lines[0].description).toBe("");
  });
});

describe("quoteFormDataToValues", () => {
  it("conserva el texto exacto, sin normalizar, y el orden de las líneas", () => {
    const formData = formDataFrom([
      ["client_id", "no-es-un-uuid"],
      ["issue_date", "2026-11-26"],
      ["irpf_rate", "7"],
      ["notes", "  con espacios  "],
      ["lines[1][description]", "Segunda"],
      ["lines[1][quantity]", "abc"],
      ["lines[0][description]", "Primera"],
      ["lines[0][quantity]", "1,5"],
      ["lines[0][unit_price]", "12,345"],
      ["lines[0][vat_rate]", "10"],
    ]);

    const values = quoteFormDataToValues(quoteFormDataToInput(formData));

    expect(values).toEqual({
      client_id: "no-es-un-uuid",
      issue_date: "2026-11-26",
      valid_until: "",
      irpf_rate: "7",
      notes: "  con espacios  ",
      lines: [
        { description: "Primera", quantity: "1,5", unit_price: "12,345", vat_rate: "10" },
        { description: "Segunda", quantity: "abc", unit_price: "", vat_rate: "" },
      ],
    });
  });

  it("sin campos ni líneas devuelve todo vacío y ninguna línea", () => {
    expect(quoteFormDataToValues({ lines: [] })).toEqual({
      client_id: "",
      issue_date: "",
      valid_until: "",
      irpf_rate: "",
      notes: "",
      lines: [],
    });
  });
});

describe("groupQuoteIssues", () => {
  it("reparte errores de cabecera, de lista, de línea y de campo de línea", () => {
    const errors = groupQuoteIssues(
      [
        { path: ["client_id"], message: "Elige un cliente." },
        { path: ["client_id"], message: "Otro error." },
        { path: ["lines"], message: "El total del presupuesto es demasiado grande." },
        { path: ["lines", 1, "quantity"], message: "La cantidad es obligatoria." },
        { path: ["lines", 0], message: "El importe de esta línea es demasiado grande." },
      ],
      2,
    );

    expect(errors).toEqual({
      fieldErrors: {
        client_id: ["Elige un cliente.", "Otro error."],
        lines: ["El total del presupuesto es demasiado grande."],
      },
      lineErrors: [
        { line: ["El importe de esta línea es demasiado grande."] },
        { quantity: ["La cantidad es obligatoria."] },
      ],
      formErrors: [],
    });
  });

  it("sin issues devuelve un objeto vacío por cada línea", () => {
    expect(groupQuoteIssues([], 3)).toEqual({
      fieldErrors: {},
      lineErrors: [{}, {}, {}],
      formErrors: [],
    });
  });

  it("con 0 líneas no crea errores de línea", () => {
    expect(groupQuoteIssues([], 0).lineErrors).toEqual([]);
  });

  it("un índice de línea fuera de rango va a la lista en vez de perderse", () => {
    const errors = groupQuoteIssues(
      [
        { path: ["lines", 5, "quantity"], message: "fuera" },
        { path: ["lines", -1], message: "negativo" },
        { path: ["lines", "x"], message: "no numérico" },
      ],
      1,
    );
    expect(errors.fieldErrors.lines).toEqual(["fuera", "negativo", "no numérico"]);
    expect(errors.lineErrors).toEqual([{}]);
  });

  it("un campo de línea desconocido o una ruta más profunda va a 'line'", () => {
    const errors = groupQuoteIssues(
      [
        { path: ["lines", 0, "otro"], message: "a" },
        { path: ["lines", 0, "quantity", "extra"], message: "b" },
      ],
      1,
    );
    expect(errors.lineErrors).toEqual([{ line: ["a", "b"] }]);
  });

  it("las rutas desconocidas o vacías van a formErrors", () => {
    const errors = groupQuoteIssues(
      [
        { path: [], message: "raíz" },
        { path: ["desconocido"], message: "otro" },
        { path: ["client_id", "sub"], message: "anidado" },
      ],
      0,
    );
    expect(errors.formErrors).toEqual(["raíz", "otro", "anidado"]);
    expect(errors.fieldErrors).toEqual({});
  });

  it("funciona con los issues reales de quoteInputSchema", () => {
    const raw = {
      client_id: "",
      issue_date: "2026-11-26",
      irpf_rate: "0",
      lines: [
        { description: "Bien", quantity: "1", unit_price: "10", vat_rate: "21" },
        { description: "", quantity: "0", unit_price: "1,234", vat_rate: "5" },
      ],
    };
    const result = quoteInputSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (result.success) return;

    const errors = groupQuoteIssues(result.error.issues, raw.lines.length);
    expect(Object.keys(errors.fieldErrors)).toEqual(["client_id"]);
    expect(errors.lineErrors[0]).toEqual({});
    expect(Object.keys(errors.lineErrors[1]).sort()).toEqual([
      "description",
      "quantity",
      "unit_price",
      "vat_rate",
    ]);
    expect(errors.formErrors).toEqual([]);
  });
});

describe("numericToHundredths", () => {
  it.each([
    [0, 0],
    [0.01, 1],
    [0.1, 10],
    [12.5, 1250],
    [15, 1500],
    [1583.25, 158325],
    [9999999999.99, 999999999999],
  ])("%d → %i centésimas", (value, expected) => {
    expect(numericToHundredths(value)).toBe(expected);
  });

  it.each([0.001, -1, Number.NaN, Number.POSITIVE_INFINITY, 1e21])(
    "rechaza %d (más de 2 decimales, negativo o no representable)",
    (value) => {
      expect(() => numericToHundredths(value)).toThrow(RangeError);
    },
  );
});

describe("texto del formulario", () => {
  it.each([
    [0, "0,00"],
    [1, "0,01"],
    [1250, "12,50"],
    [100000, "1000,00"],
  ])("fijo: %i → %j", (value, expected) => {
    expect(hundredthsToFixedText(value)).toBe(expected);
  });

  it.each([
    [0, "0"],
    [1, "0,01"],
    [10, "0,1"],
    [100, "1"],
    [750, "7,5"],
    [1000, "10"],
    [1500, "15"],
    [10050, "100,5"],
    [10000, "100"],
  ])("compacto: %i → %j", (value, expected) => {
    expect(hundredthsToCompactText(value)).toBe(expected);
  });
});

describe("storedQuoteToFormValues", () => {
  const stored: StoredQuote = {
    client_id: CLIENT_ID,
    issue_date: "2026-11-26",
    valid_until: null,
    irpf_rate: 7,
    notes: null,
    lines: [
      { position: 1, description: "Segunda", quantity: 500, unit_price: 0.85, vat_rate: 21 },
      { position: 0, description: "Primera", quantity: 1.5, unit_price: 33.33, vat_rate: 0 },
    ],
  };

  it("pasa la BD a texto del formulario y ordena por posición", () => {
    expect(storedQuoteToFormValues(stored)).toEqual({
      client_id: CLIENT_ID,
      issue_date: "2026-11-26",
      valid_until: "",
      irpf_rate: "7",
      notes: "",
      lines: [
        { description: "Primera", quantity: "1,5", unit_price: "33,33", vat_rate: "0" },
        { description: "Segunda", quantity: "500", unit_price: "0,85", vat_rate: "21" },
      ],
    });
  });

  it("no modifica las líneas recibidas", () => {
    storedQuoteToFormValues(stored);
    expect(stored.lines.map((line) => line.position)).toEqual([1, 0]);
  });

  it("conserva validez y notas cuando existen", () => {
    const values = storedQuoteToFormValues({
      ...stored,
      valid_until: "2026-12-26",
      notes: "Notas",
      irpf_rate: 15,
    });
    expect(values.valid_until).toBe("2026-12-26");
    expect(values.notes).toBe("Notas");
    expect(values.irpf_rate).toBe("15");
  });

  it("ida y vuelta: lo que genera vuelve a validar con los mismos importes", () => {
    const values = storedQuoteToFormValues(stored);
    const result = quoteInputSchema.safeParse(values);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.irpf_rate).toBe(700);
    expect(result.data.lines).toEqual([
      { description: "Primera", quantity_hundredths: 150, unit_price_cents: 3333, vat_rate: 0 },
      { description: "Segunda", quantity_hundredths: 50000, unit_price_cents: 85, vat_rate: 21 },
    ]);
  });

  it("lanza si la BD devuelve un valor con más de 2 decimales", () => {
    expect(() =>
      storedQuoteToFormValues({
        ...stored,
        lines: [{ position: 0, description: "x", quantity: 1.005, unit_price: 1, vat_rate: 21 }],
      }),
    ).toThrow(RangeError);
  });
});
