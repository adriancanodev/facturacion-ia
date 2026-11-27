import {
  MAX_AMOUNT_CENTS,
  MAX_QUANTITY_HUNDREDTHS,
  bigintToSafeNumber,
  parseDecimalToHundredths,
  type Cents,
} from "./money";
import type { QuoteFormValues, QuoteLineFormValues } from "./quote-form";
import {
  MAX_IRPF_RATE_HUNDREDTHS,
  VAT_RATES,
  calculateLineBase,
  computeQuoteTotals,
  findAmountRangeIssue,
  type QuoteLineAmounts,
  type QuoteTotals,
  type VatRate,
} from "./quote-totals";

export type LiveQuoteSummary = Omit<QuoteTotals, "lines">;

export type LiveQuoteTotals = {
  lineBases: Array<Cents | null>;
  includedLineCount: number;
  irpfRateHundredths: number | null;
  summary: LiveQuoteSummary | null;
  totalTooLarge: boolean;
};

function parseVatRate(text: string): VatRate | null {
  const trimmed = text.trim();
  return VAT_RATES.find((rate) => String(rate) === trimmed) ?? null;
}

function parseLineAmounts(line: QuoteLineFormValues): QuoteLineAmounts | null {
  const quantity = parseDecimalToHundredths(line.quantity, MAX_QUANTITY_HUNDREDTHS);
  const unitPrice = parseDecimalToHundredths(line.unit_price, MAX_AMOUNT_CENTS);
  const vatRate = parseVatRate(line.vat_rate);
  if (!quantity.ok || quantity.value === 0 || !unitPrice.ok || vatRate === null) return null;

  return {
    quantity_hundredths: quantity.value,
    unit_price_cents: unitPrice.value,
    vat_rate: vatRate,
  };
}

function lineBaseWithinRange(amounts: QuoteLineAmounts): Cents | null {
  const base = calculateLineBase(amounts.quantity_hundredths, amounts.unit_price_cents);
  return base > BigInt(MAX_AMOUNT_CENTS) ? null : bigintToSafeNumber(base);
}

function parseIrpfRate(text: string): number | null {
  if (text.trim() === "") return 0;
  const result = parseDecimalToHundredths(text, MAX_IRPF_RATE_HUNDREDTHS);
  return result.ok ? result.value : null;
}

export function computeLiveQuoteTotals(values: QuoteFormValues): LiveQuoteTotals {
  const includedLines: QuoteLineAmounts[] = [];
  const lineBases = values.lines.map((line) => {
    const amounts = parseLineAmounts(line);
    if (amounts === null) return null;
    const base = lineBaseWithinRange(amounts);
    if (base !== null) includedLines.push(amounts);
    return base;
  });

  const irpfRateHundredths = parseIrpfRate(values.irpf_rate);
  const effectiveIrpfRate = irpfRateHundredths ?? 0;
  const result = {
    lineBases,
    includedLineCount: includedLines.length,
    irpfRateHundredths,
  };

  if (includedLines.length === 0) {
    return { ...result, summary: null, totalTooLarge: false };
  }
  if (findAmountRangeIssue(includedLines, effectiveIrpfRate) !== null) {
    return { ...result, summary: null, totalTooLarge: true };
  }

  const { lines: _lines, ...summary } = computeQuoteTotals(includedLines, effectiveIrpfRate);
  return { ...result, summary, totalTooLarge: false };
}
