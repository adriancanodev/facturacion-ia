import { describe, expect, it } from "vitest";

import {
  QUOTE_LINES_MAX,
  QUOTE_LINE_DESCRIPTION_MAX_LENGTH,
  QUOTE_NOTES_MAX_LENGTH,
  quoteFormDataToInput,
  quoteInputSchema,
} from "@/lib/domain/quote";
import { computeQuoteTotals } from "@/lib/domain/quote-totals";

const CLIENT_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

const validLine = {
  description: "Diseño de la web",
  quantity: "1,5",
  unit_price: "10,01",
  vat_rate: "21",
};

// Datos válidos de partida: cada test cambia solo lo que le interesa.
const validInput = {
  client_id: CLIENT_ID,
  issue_date: "2026-11-26",
  valid_until: "2026-12-26",
  irpf_rate: "15",
  notes: "Validez de 30 días.",
  lines: [validLine],
};

// Errores como "ruta → mensajes", la ruta tal como la usará el formulario.
function errorsByPath(input: unknown): Record<string, string[]> {
  const result = quoteInputSchema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    (errors[path] ??= []).push(issue.message);
  }
  return errors;
}

describe("quoteInputSchema: datos válidos", () => {
  it("convierte a enteros: centésimas de unidad, céntimos y centésimas de %", () => {
    expect(quoteInputSchema.parse(validInput)).toEqual({
      client_id: CLIENT_ID,
      issue_date: "2026-11-26",
      valid_until: "2026-12-26",
      irpf_rate: 1500,
      notes: "Validez de 30 días.",
      lines: [
        {
          description: "Diseño de la web",
          quantity_hundredths: 150,
          unit_price_cents: 1001,
          vat_rate: 21,
        },
      ],
    });
  });

  it("su salida se puede pasar directamente a computeQuoteTotals", () => {
    const quote = quoteInputSchema.parse(validInput);
    const totals = computeQuoteTotals(quote.lines, quote.irpf_rate);
    // 1,5 × 10,01 = 15,015 → 15,02; IVA 21 % = 3,1542 → 3,15; IRPF 15 % = 2,253 → 2,25
    expect(totals).toMatchObject({ subtotal: 1502, vat_total: 315, irpf_total: 225, total: 1592 });
    expect(totals.lines[0].description).toBe("Diseño de la web");
  });

  it("valid_until, notes e irpf_rate son opcionales (vacíos → null / 0)", () => {
    const result = quoteInputSchema.parse({
      ...validInput,
      valid_until: "",
      notes: "   ",
      irpf_rate: "",
    });
    expect(result.valid_until).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.irpf_rate).toBe(0);
  });

  it("valid_until, notes e irpf_rate pueden no llegar", () => {
    const result = quoteInputSchema.parse({
      client_id: CLIENT_ID,
      issue_date: "2026-11-26",
      lines: [validLine],
    });
    expect(result).toMatchObject({ valid_until: null, notes: null, irpf_rate: 0 });
  });

  it("valid_until puede ser el mismo día que issue_date", () => {
    expect(quoteInputSchema.safeParse({ ...validInput, valid_until: "2026-11-26" }).success).toBe(
      true,
    );
  });

  it.each([
    ["0", 0],
    ["7", 700],
    ["15", 1500],
    ["19", 1900],
    ["15,5", 1550],
    ["100", 10000],
  ])("IRPF %j → %i centésimas", (text, expected) => {
    expect(quoteInputSchema.parse({ ...validInput, irpf_rate: text }).irpf_rate).toBe(expected);
  });

  it("acepta IRPF e IVA como número (por si el editor los guarda así)", () => {
    const result = quoteInputSchema.parse({
      ...validInput,
      irpf_rate: 7,
      lines: [{ ...validLine, vat_rate: 10 }],
    });
    expect(result.irpf_rate).toBe(700);
    expect(result.lines[0].vat_rate).toBe(10);
  });

  it.each(["0", "4", "10", "21"])("acepta IVA %j", (rate) => {
    const result = quoteInputSchema.parse({ ...validInput, lines: [{ ...validLine, vat_rate: rate }] });
    expect(String(result.lines[0].vat_rate)).toBe(rate);
  });

  it("recorta la descripción y admite precio 0", () => {
    const result = quoteInputSchema.parse({
      ...validInput,
      lines: [{ ...validLine, description: "  Regalo  ", unit_price: "0" }],
    });
    expect(result.lines[0]).toMatchObject({ description: "Regalo", unit_price_cents: 0 });
  });

  it("admite el máximo de líneas", () => {
    const lines = Array.from({ length: QUOTE_LINES_MAX }, () => validLine);
    expect(quoteInputSchema.safeParse({ ...validInput, lines }).success).toBe(true);
  });
});

describe("quoteInputSchema: errores de cabecera", () => {
  it("sin líneas", () => {
    expect(errorsByPath({ ...validInput, lines: [] })).toEqual({
      lines: ["Añade al menos una línea."],
    });
  });

  it("sin el campo lines", () => {
    const { lines: _lines, ...withoutLines } = validInput;
    expect(errorsByPath(withoutLines)).toEqual({ lines: ["Añade al menos una línea."] });
  });

  it("demasiadas líneas", () => {
    const lines = Array.from({ length: QUOTE_LINES_MAX + 1 }, () => validLine);
    expect(errorsByPath({ ...validInput, lines })).toEqual({
      lines: [`Un presupuesto puede tener como máximo ${QUOTE_LINES_MAX} líneas.`],
    });
  });

  it.each([undefined, "", "no-es-un-uuid"])("client_id inválido %j", (clientId) => {
    expect(errorsByPath({ ...validInput, client_id: clientId })).toEqual({
      client_id: ["Elige un cliente."],
    });
  });

  it.each([undefined, "", "26/11/2026", "2026-02-30", "2026-13-01"])(
    "issue_date inválida %j",
    (date) => {
      expect(errorsByPath({ ...validInput, issue_date: date })).toEqual({
        issue_date: ["La fecha de emisión no es válida."],
      });
    },
  );

  it("valid_until con formato inválido", () => {
    expect(errorsByPath({ ...validInput, valid_until: "mañana" })).toEqual({
      valid_until: ["La fecha de validez no es válida."],
    });
  });

  it("valid_until anterior a issue_date", () => {
    expect(errorsByPath({ ...validInput, valid_until: "2026-11-25" })).toEqual({
      valid_until: ["La fecha de validez no puede ser anterior a la fecha de emisión."],
    });
  });

  it("la comprobación de fechas convive con errores en las líneas", () => {
    const errors = errorsByPath({
      ...validInput,
      valid_until: "2026-11-25",
      lines: [{ ...validLine, quantity: "abc" }],
    });
    expect(Object.keys(errors).sort()).toEqual(["lines.0.quantity", "valid_until"]);
  });

  it.each([
    ["-7", "El IRPF no puede ser negativo."],
    ["abc", "El IRPF debe ser un número, por ejemplo 7 o 15."],
    ["15,555", "El IRPF admite como máximo 2 decimales."],
    ["100,01", "El IRPF no puede superar el 100 %."],
  ])("IRPF inválido %j", (rate, message) => {
    expect(errorsByPath({ ...validInput, irpf_rate: rate })).toEqual({ irpf_rate: [message] });
  });

  it("notas demasiado largas", () => {
    expect(
      errorsByPath({ ...validInput, notes: "a".repeat(QUOTE_NOTES_MAX_LENGTH + 1) }),
    ).toEqual({
      notes: [`Las notas no pueden superar los ${QUOTE_NOTES_MAX_LENGTH} caracteres.`],
    });
  });
});

describe("quoteInputSchema: errores de línea con su ruta", () => {
  // La línea con el error es la tercera (índice 2): la ruta lo identifica.
  function lineErrors(badLine: Record<string, unknown>) {
    return errorsByPath({ ...validInput, lines: [validLine, validLine, badLine] });
  }

  it.each([
    ["", "La cantidad es obligatoria."],
    ["abc", "La cantidad debe ser un número, por ejemplo 2 o 1,5."],
    ["1,2,3", "La cantidad debe ser un número, por ejemplo 2 o 1,5."],
    ["-1", "La cantidad no puede ser negativa."],
    ["0", "La cantidad debe ser mayor que 0."],
    ["0,00", "La cantidad debe ser mayor que 0."],
    ["1,234", "La cantidad admite como máximo 2 decimales."],
    ["1.234", "La cantidad admite como máximo 2 decimales."],
    ["0,333", "La cantidad admite como máximo 2 decimales."],
    ["10000000000", "La cantidad no puede superar 9.999.999.999,99."],
  ])("cantidad %j", (quantity, message) => {
    expect(lineErrors({ ...validLine, quantity })).toEqual({ "lines.2.quantity": [message] });
  });

  it.each([
    ["", "El precio es obligatorio."],
    ["doce", "El precio debe ser un número, por ejemplo 25 o 12,50."],
    ["-5", "El precio no puede ser negativo."],
    ["12,505", "El precio admite como máximo 2 decimales."],
    ["10000000000", "El precio no puede superar 9.999.999.999,99 €."],
  ])("precio %j", (unitPrice, message) => {
    expect(lineErrors({ ...validLine, unit_price: unitPrice })).toEqual({
      "lines.2.unit_price": [message],
    });
  });

  it.each(["16", "", "veintiuno", 7])("IVA no permitido %j", (vatRate) => {
    expect(lineErrors({ ...validLine, vat_rate: vatRate })).toEqual({
      "lines.2.vat_rate": ["Elige un tipo de IVA: 21, 10, 4 o 0 %."],
    });
  });

  it("descripción vacía o demasiado larga", () => {
    expect(lineErrors({ ...validLine, description: "   " })).toEqual({
      "lines.2.description": ["La descripción es obligatoria."],
    });
    expect(
      lineErrors({ ...validLine, description: "a".repeat(QUOTE_LINE_DESCRIPTION_MAX_LENGTH + 1) }),
    ).toEqual({
      "lines.2.description": [
        `La descripción no puede superar los ${QUOTE_LINE_DESCRIPTION_MAX_LENGTH} caracteres.`,
      ],
    });
  });

  it("línea sin ningún campo: un error por campo", () => {
    expect(Object.keys(lineErrors({})).sort()).toEqual([
      "lines.2.description",
      "lines.2.quantity",
      "lines.2.unit_price",
      "lines.2.vat_rate",
    ]);
  });

  it("importe de línea que no cabe en la BD: error en la línea", () => {
    expect(lineErrors({ ...validLine, quantity: "999999999", unit_price: "9999999999" })).toEqual({
      "lines.2": ["El importe de esta línea es demasiado grande."],
    });
  });

  it("total que no cabe en la BD: error en las líneas", () => {
    const bigLine = { ...validLine, quantity: "1", unit_price: "9999999999,99", vat_rate: "21" };
    expect(errorsByPath({ ...validInput, lines: [bigLine] })).toEqual({
      lines: ["El total del presupuesto es demasiado grande."],
    });
  });
});

describe("quoteFormDataToInput", () => {
  function buildFormData(entries: Array<[string, string]>): FormData {
    const formData = new FormData();
    for (const [name, value] of entries) formData.append(name, value);
    return formData;
  }

  it("convierte los campos indexados en un array de líneas", () => {
    const formData = buildFormData([
      ["client_id", CLIENT_ID],
      ["issue_date", "2026-11-26"],
      ["valid_until", ""],
      ["irpf_rate", "7"],
      ["notes", "Gracias"],
      ["lines[0][description]", "Diseño"],
      ["lines[0][quantity]", "2"],
      ["lines[0][unit_price]", "100"],
      ["lines[0][vat_rate]", "21"],
      ["lines[1][description]", "Libro"],
      ["lines[1][quantity]", "1"],
      ["lines[1][unit_price]", "12,50"],
      ["lines[1][vat_rate]", "4"],
    ]);

    const input = quoteFormDataToInput(formData);
    expect(input).toEqual({
      client_id: CLIENT_ID,
      issue_date: "2026-11-26",
      valid_until: "",
      irpf_rate: "7",
      notes: "Gracias",
      lines: [
        { description: "Diseño", quantity: "2", unit_price: "100", vat_rate: "21" },
        { description: "Libro", quantity: "1", unit_price: "12,50", vat_rate: "4" },
      ],
    });
    expect(quoteInputSchema.safeParse(input).success).toBe(true);
  });

  it("ordena por índice y compacta los huecos (0, 5, 2 → 0, 1, 2)", () => {
    const formData = buildFormData([
      ["lines[0][description]", "A"],
      ["lines[5][description]", "C"],
      ["lines[2][description]", "B"],
      ["lines[10][description]", "D"],
    ]);
    expect(quoteFormDataToInput(formData).lines.map((l) => l.description)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("ignora campos de línea desconocidos y nombres mal formados", () => {
    const formData = buildFormData([
      ["lines[0][description]", "A"],
      ["lines[0][base]", "999"],
      ["lines[x][quantity]", "1"],
      ["lines[0]", "nada"],
      ["otro", "valor"],
    ]);
    expect(quoteFormDataToInput(formData).lines).toEqual([{ description: "A" }]);
  });

  it("ignora archivos y deja ausentes los campos que no llegan", () => {
    const formData = new FormData();
    formData.append("client_id", new Blob(["x"]), "archivo.txt");
    formData.append("lines[0][description]", new Blob(["x"]), "archivo.txt");
    expect(quoteFormDataToInput(formData)).toEqual({
      client_id: undefined,
      issue_date: undefined,
      valid_until: undefined,
      irpf_rate: undefined,
      notes: undefined,
      lines: [],
    });
  });

  it("los errores de un FormData incompleto llevan la ruta de la línea", () => {
    const formData = buildFormData([
      ["client_id", CLIENT_ID],
      ["issue_date", "2026-11-26"],
      ["lines[0][description]", "Diseño"],
      ["lines[0][quantity]", "2"],
      ["lines[0][unit_price]", "100"],
      ["lines[0][vat_rate]", "21"],
      ["lines[1][description]", "Libro"],
      ["lines[1][unit_price]", "12,50"],
      ["lines[1][vat_rate]", "4"],
    ]);
    expect(errorsByPath(quoteFormDataToInput(formData))).toEqual({
      "lines.1.quantity": ["La cantidad es obligatoria."],
    });
  });
});
