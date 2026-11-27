import type { Cents } from "./money";
import { numericToHundredths } from "./quote-form";
import {
  computeQuoteTotals,
  isVatRate,
  type QuoteLineAmounts,
  type VatBreakdownEntry,
} from "./quote-totals";

export type StoredQuoteAmounts = {
  irpf_rate: number;
  subtotal: number;
  vat_total: number;
  irpf_total: number;
  total: number;
};

export type StoredQuoteLineAmounts = {
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

export type QuoteSummary = {
  subtotal: Cents;
  vatTotal: Cents;
  irpfRateHundredths: number;
  irpfTotal: Cents;
  total: Cents;
  vatBreakdown: VatBreakdownEntry[] | null;
};

export function buildQuoteSummary(
  quote: StoredQuoteAmounts,
  lines: readonly StoredQuoteLineAmounts[],
): QuoteSummary {
  const irpfRateHundredths = numericToHundredths(quote.irpf_rate);
  const vatTotal = numericToHundredths(quote.vat_total);

  return {
    subtotal: numericToHundredths(quote.subtotal),
    vatTotal,
    irpfRateHundredths,
    irpfTotal: numericToHundredths(quote.irpf_total),
    total: numericToHundredths(quote.total),
    vatBreakdown: recomputeVatBreakdown(lines, irpfRateHundredths, vatTotal),
  };
}

function recomputeVatBreakdown(
  lines: readonly StoredQuoteLineAmounts[],
  irpfRateHundredths: number,
  storedVatTotal: Cents,
): VatBreakdownEntry[] | null {
  if (lines.length === 0) return null;

  // Los datos guardados ya pasaron por las restricciones de la BD; si aun así algo no
  // encaja con el dominio, preferimos no mostrar el desglose antes que romper la página.
  try {
    const amounts: QuoteLineAmounts[] = [];
    for (const line of lines) {
      const lineAmounts = toLineAmounts(line);
      if (lineAmounts === null) return null;
      amounts.push(lineAmounts);
    }

    const totals = computeQuoteTotals(amounts, irpfRateHundredths);
    return totals.vat_total === storedVatTotal ? totals.vat_breakdown : null;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

function toLineAmounts(line: StoredQuoteLineAmounts): QuoteLineAmounts | null {
  if (!isVatRate(line.vat_rate)) return null;
  return {
    quantity_hundredths: numericToHundredths(line.quantity),
    unit_price_cents: numericToHundredths(line.unit_price),
    vat_rate: line.vat_rate,
  };
}
