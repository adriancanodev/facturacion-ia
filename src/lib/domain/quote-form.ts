import { DECIMAL_PLACES, parseDecimalToHundredths, toDecimalString } from "./money";
import type { QuoteFormData } from "./quote";
import type { VatRate } from "./quote-totals";

export const QUOTE_HEADER_FIELDS = [
  "client_id",
  "issue_date",
  "valid_until",
  "irpf_rate",
  "notes",
] as const;
export type QuoteHeaderField = (typeof QUOTE_HEADER_FIELDS)[number];

export const QUOTE_LINE_FIELDS = ["description", "quantity", "unit_price", "vat_rate"] as const;
export type QuoteLineField = (typeof QUOTE_LINE_FIELDS)[number];

export const DEFAULT_VAT_RATE: VatRate = 21;

export type QuoteLineFormValues = Record<QuoteLineField, string>;

export type QuoteFormValues = Record<QuoteHeaderField, string> & {
  lines: QuoteLineFormValues[];
};

export type QuoteFieldErrors = Partial<Record<QuoteHeaderField | "lines", string[]>>;

export type QuoteLineErrors = Partial<Record<QuoteLineField | "line", string[]>>;

export type QuoteValidationErrors = {
  fieldErrors: QuoteFieldErrors;
  lineErrors: QuoteLineErrors[];
  formErrors: string[];
};

export type ValidationIssue = {
  readonly path: readonly PropertyKey[];
  readonly message: string;
};

export function emptyQuoteLineValues(): QuoteLineFormValues {
  return { description: "", quantity: "", unit_price: "", vat_rate: String(DEFAULT_VAT_RATE) };
}

export function emptyQuoteFormValues(): QuoteFormValues {
  return {
    client_id: "",
    issue_date: "",
    valid_until: "",
    irpf_rate: "0",
    notes: "",
    lines: [emptyQuoteLineValues()],
  };
}

export function quoteFormDataToValues(data: QuoteFormData): QuoteFormValues {
  return {
    client_id: data.client_id ?? "",
    issue_date: data.issue_date ?? "",
    valid_until: data.valid_until ?? "",
    irpf_rate: data.irpf_rate ?? "",
    notes: data.notes ?? "",
    lines: data.lines.map((line) => ({
      description: line.description ?? "",
      quantity: line.quantity ?? "",
      unit_price: line.unit_price ?? "",
      vat_rate: line.vat_rate ?? "",
    })),
  };
}

function isHeaderField(value: PropertyKey | undefined): value is QuoteHeaderField {
  return value !== undefined && (QUOTE_HEADER_FIELDS as readonly PropertyKey[]).includes(value);
}

function isLineField(value: PropertyKey | undefined): value is QuoteLineField {
  return value !== undefined && (QUOTE_LINE_FIELDS as readonly PropertyKey[]).includes(value);
}

function addError<Key extends string>(
  target: Partial<Record<Key, string[]>>,
  key: Key,
  message: string,
): void {
  (target[key] ??= []).push(message);
}

export function groupQuoteIssues(
  issues: readonly ValidationIssue[],
  lineCount: number,
): QuoteValidationErrors {
  const fieldErrors: QuoteFieldErrors = {};
  const lineErrors: QuoteLineErrors[] = Array.from({ length: lineCount }, () => ({}));
  const formErrors: string[] = [];

  for (const { path, message } of issues) {
    const [first, index, field] = path;

    if (isHeaderField(first) && path.length === 1) {
      addError(fieldErrors, first, message);
      continue;
    }

    if (first !== "lines") {
      formErrors.push(message);
      continue;
    }

    if (path.length === 1) {
      addError(fieldErrors, "lines", message);
      continue;
    }

    const lineIndex = typeof index === "number" ? index : Number.NaN;
    const lineError = lineErrors[lineIndex];
    if (!Number.isInteger(lineIndex) || lineError === undefined) {
      addError(fieldErrors, "lines", message);
      continue;
    }

    addError(lineError, path.length === 3 && isLineField(field) ? field : "line", message);
  }

  return { fieldErrors, lineErrors, formErrors };
}

export function numericToHundredths(value: number): number {
  const result = parseDecimalToHundredths(String(value), Number.MAX_SAFE_INTEGER);
  if (!result.ok) {
    throw new RangeError(`Valor numeric no representable con ${DECIMAL_PLACES} decimales.`);
  }
  return result.value;
}

export function hundredthsToFixedText(value: number): string {
  return toDecimalString(value).replace(".", ",");
}

export function hundredthsToCompactText(value: number): string {
  return hundredthsToFixedText(value).replace(/,?0+$/, "");
}

export type StoredQuoteLine = {
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

export type StoredQuote = {
  client_id: string;
  issue_date: string;
  valid_until: string | null;
  irpf_rate: number;
  notes: string | null;
  lines: readonly StoredQuoteLine[];
};

export function storedQuoteToFormValues(quote: StoredQuote): QuoteFormValues {
  const lines = [...quote.lines]
    .sort((a, b) => a.position - b.position)
    .map((line) => ({
      description: line.description,
      quantity: hundredthsToCompactText(numericToHundredths(line.quantity)),
      unit_price: hundredthsToFixedText(numericToHundredths(line.unit_price)),
      vat_rate: String(line.vat_rate),
    }));

  return {
    client_id: quote.client_id,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until ?? "",
    irpf_rate: hundredthsToCompactText(numericToHundredths(quote.irpf_rate)),
    notes: quote.notes ?? "",
    lines,
  };
}
