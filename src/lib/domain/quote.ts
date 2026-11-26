import { z } from "zod";

import {
  MAX_AMOUNT_CENTS,
  MAX_QUANTITY_HUNDREDTHS,
  parseDecimalToHundredths,
  type DecimalParseError,
} from "./money";
import {
  MAX_IRPF_RATE_HUNDREDTHS,
  VAT_RATES,
  findAmountRangeIssue,
} from "./quote-totals";

export const QUOTE_LINES_MIN = 1;
export const QUOTE_LINES_MAX = 100;
export const QUOTE_LINE_DESCRIPTION_MAX_LENGTH = 500;
export const QUOTE_NOTES_MAX_LENGTH = 1000;

type DecimalMessages = Record<DecimalParseError, string> & {
  required: string;
  zero?: string;
};

function decimalTextField(maxValue: number, messages: DecimalMessages) {
  return z
    .string({ error: messages.required })
    .transform((text, ctx) => {
      const result = parseDecimalToHundredths(text, maxValue);
      if (!result.ok) {
        ctx.issues.push({ code: "custom", message: messages[result.error], input: text });
        return z.NEVER;
      }
      if (messages.zero && result.value === 0) {
        ctx.issues.push({ code: "custom", message: messages.zero, input: text });
        return z.NEVER;
      }
      return result.value;
    });
}

const quantityField = decimalTextField(MAX_QUANTITY_HUNDREDTHS, {
  required: "La cantidad es obligatoria.",
  empty: "La cantidad es obligatoria.",
  invalid: "La cantidad debe ser un número, por ejemplo 2 o 1,5.",
  negative: "La cantidad no puede ser negativa.",
  too_many_decimals: "La cantidad admite como máximo 2 decimales.",
  too_large: "La cantidad no puede superar 9.999.999.999,99.",
  zero: "La cantidad debe ser mayor que 0.",
});

const unitPriceField = decimalTextField(MAX_AMOUNT_CENTS, {
  required: "El precio es obligatorio.",
  empty: "El precio es obligatorio.",
  invalid: "El precio debe ser un número, por ejemplo 25 o 12,50.",
  negative: "El precio no puede ser negativo.",
  too_many_decimals: "El precio admite como máximo 2 decimales.",
  too_large: "El precio no puede superar 9.999.999.999,99 €.",
});

const IRPF_MESSAGES: Record<DecimalParseError, string> = {
  empty: "Elige un tipo de IRPF.",
  invalid: "El IRPF debe ser un número, por ejemplo 7 o 15.",
  negative: "El IRPF no puede ser negativo.",
  too_many_decimals: "El IRPF admite como máximo 2 decimales.",
  too_large: "El IRPF no puede superar el 100 %.",
};

const irpfRateField = z
  .union([z.string(), z.number()], { error: IRPF_MESSAGES.invalid })
  .optional()
  .transform((value, ctx) => {
    const text = value === undefined ? "" : String(value).trim();
    if (text === "") return 0;
    const result = parseDecimalToHundredths(text, MAX_IRPF_RATE_HUNDREDTHS);
    if (!result.ok) {
      ctx.issues.push({ code: "custom", message: IRPF_MESSAGES[result.error], input: value });
      return z.NEVER;
    }
    return result.value;
  });

const VAT_RATE_MESSAGE = "Elige un tipo de IVA: 21, 10, 4 o 0 %.";

const vatRateField = z
  .union([z.string(), z.number()], { error: VAT_RATE_MESSAGE })
  .transform((value, ctx) => {
    const text = String(value).trim();
    const rate = VAT_RATES.find((candidate) => String(candidate) === text);
    if (rate === undefined) {
      ctx.issues.push({ code: "custom", message: VAT_RATE_MESSAGE, input: value });
      return z.NEVER;
    }
    return rate;
  });

const quoteLineSchema = z
  .object({
    description: z
      .string({ error: "La descripción es obligatoria." })
      .trim()
      .min(1, { error: "La descripción es obligatoria." })
      .max(QUOTE_LINE_DESCRIPTION_MAX_LENGTH, {
        error: `La descripción no puede superar los ${QUOTE_LINE_DESCRIPTION_MAX_LENGTH} caracteres.`,
      }),
    quantity: quantityField,
    unit_price: unitPriceField,
    vat_rate: vatRateField,
  })
  .transform((line) => ({
    description: line.description,
    quantity_hundredths: line.quantity,
    unit_price_cents: line.unit_price,
    vat_rate: line.vat_rate,
  }));

function emptyToNull(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

function hasIssuesIn(issues: readonly { path?: PropertyKey[] }[], fields: string[]): boolean {
  return issues.some((issue) => fields.includes(String(issue.path?.[0])));
}

export const quoteInputSchema = z
  .object({
    client_id: z.uuid({ error: "Elige un cliente." }),

    issue_date: z.iso.date({ error: "La fecha de emisión no es válida." }),

    valid_until: z
      .string({ error: "La fecha de validez no es válida." })
      .trim()
      .optional()
      .transform(emptyToNull)
      .pipe(z.iso.date({ error: "La fecha de validez no es válida." }).nullable()),

    irpf_rate: irpfRateField,

    notes: z
      .string({ error: "Las notas no son válidas." })
      .trim()
      .max(QUOTE_NOTES_MAX_LENGTH, {
        error: `Las notas no pueden superar los ${QUOTE_NOTES_MAX_LENGTH} caracteres.`,
      })
      .optional()
      .transform(emptyToNull),

    lines: z
      .array(quoteLineSchema, { error: "Añade al menos una línea." })
      .min(QUOTE_LINES_MIN, { error: "Añade al menos una línea." })
      .max(QUOTE_LINES_MAX, {
        error: `Un presupuesto puede tener como máximo ${QUOTE_LINES_MAX} líneas.`,
      }),
  })
  .refine(
    (quote) => quote.valid_until === null || quote.valid_until >= quote.issue_date,
    {
      path: ["valid_until"],
      error: "La fecha de validez no puede ser anterior a la fecha de emisión.",
      when: (payload) => !hasIssuesIn(payload.issues, ["issue_date", "valid_until"]),
    },
  )
  .superRefine(
    (quote, ctx) => {
      const issue = findAmountRangeIssue(quote.lines, quote.irpf_rate);
      if (issue?.kind === "line_too_large") {
        ctx.addIssue({
          code: "custom",
          path: ["lines", issue.lineIndex],
          message: "El importe de esta línea es demasiado grande.",
        });
      } else if (issue?.kind === "total_too_large") {
        ctx.addIssue({
          code: "custom",
          path: ["lines"],
          message: "El total del presupuesto es demasiado grande.",
        });
      }
    },
    { when: (payload) => !hasIssuesIn(payload.issues, ["lines", "irpf_rate"]) },
  );

export type QuoteFormInput = z.input<typeof quoteInputSchema>;
export type QuoteInput = z.output<typeof quoteInputSchema>;
export type QuoteLineInput = QuoteInput["lines"][number];

const LINE_FIELDS = ["description", "quantity", "unit_price", "vat_rate"] as const;
type LineField = (typeof LINE_FIELDS)[number];
type RawLine = Partial<Record<LineField, string>>;

export type QuoteFormData = {
  client_id?: string;
  issue_date?: string;
  valid_until?: string;
  irpf_rate?: string;
  notes?: string;
  lines: RawLine[];
};

const LINE_FIELD_NAME = /^lines\[(\d+)\]\[([a-z_]+)\]$/;

function isLineField(value: string): value is LineField {
  return (LINE_FIELDS as readonly string[]).includes(value);
}

function textOrUndefined(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function quoteFormDataToInput(formData: FormData): QuoteFormData {
  const linesByIndex = new Map<number, RawLine>();

  for (const [name, value] of formData.entries()) {
    const match = LINE_FIELD_NAME.exec(name);
    if (!match || typeof value !== "string" || !isLineField(match[2])) continue;

    const index = Number.parseInt(match[1], 10);
    const line = linesByIndex.get(index) ?? {};
    line[match[2]] = value;
    linesByIndex.set(index, line);
  }

  const lines = [...linesByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, line]) => line);

  return {
    client_id: textOrUndefined(formData.get("client_id")),
    issue_date: textOrUndefined(formData.get("issue_date")),
    valid_until: textOrUndefined(formData.get("valid_until")),
    irpf_rate: textOrUndefined(formData.get("irpf_rate")),
    notes: textOrUndefined(formData.get("notes")),
    lines,
  };
}
