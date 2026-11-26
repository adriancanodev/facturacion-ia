import {
  emptyQuoteFormValues,
  storedQuoteToFormValues,
  type QuoteFieldErrors,
  type QuoteFormValues,
  type QuoteLineErrors,
} from "@/lib/domain/quote-form";
import type { Tables } from "@/types/database";

export type QuoteFormState = {
  fieldErrors: QuoteFieldErrors;
  lineErrors: QuoteLineErrors[];
  formError: string | null;
  values: QuoteFormValues;
};

function stateFromValues(values: QuoteFormValues): QuoteFormState {
  return {
    fieldErrors: {},
    lineErrors: values.lines.map(() => ({})),
    formError: null,
    values,
  };
}

export const initialQuoteFormState: QuoteFormState = stateFromValues(emptyQuoteFormValues());

export type EditableQuoteRow = Pick<
  Tables<"quotes">,
  "client_id" | "issue_date" | "valid_until" | "irpf_rate" | "notes"
>;

export type EditableQuoteLineRow = Pick<
  Tables<"quote_lines">,
  "position" | "description" | "quantity" | "unit_price" | "vat_rate"
>;

export function quoteFormStateFromRows(
  quote: EditableQuoteRow,
  lines: readonly EditableQuoteLineRow[],
): QuoteFormState {
  return stateFromValues(storedQuoteToFormValues({ ...quote, lines }));
}

export type QuoteActionState = {
  error: string | null;
};

export const initialQuoteActionState: QuoteActionState = { error: null };
