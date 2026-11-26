import {
  MAX_AMOUNT_CENTS,
  MAX_QUANTITY_HUNDREDTHS,
  bigintToSafeNumber,
  divideRoundHalfUp,
  type Cents,
  type Hundredths,
} from "./money";

export const VAT_RATES = [21, 10, 4, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];

export const MAX_IRPF_RATE_HUNDREDTHS = 100_00;

export function isVatRate(value: number): value is VatRate {
  return (VAT_RATES as readonly number[]).includes(value);
}

export type QuoteLineAmounts = {
  quantity_hundredths: Hundredths;
  unit_price_cents: Cents;
  vat_rate: VatRate;
};

export type VatBreakdownEntry = {
  vat_rate: VatRate;
  base: Cents;
  vat: Cents;
};

export type QuoteTotals<Line extends QuoteLineAmounts = QuoteLineAmounts> = {
  lines: Array<Line & { base: Cents }>;
  vat_breakdown: VatBreakdownEntry[];
  subtotal: Cents;
  vat_total: Cents;
  irpf_total: Cents;
  total: Cents;
};

export type AmountRangeIssue =
  | { kind: "line_too_large"; lineIndex: number }
  | { kind: "total_too_large" };

const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10000);
const ZERO = BigInt(0);

export function calculateLineBase(
  quantityHundredths: Hundredths,
  unitPriceCents: Cents,
): bigint {
  return divideRoundHalfUp(BigInt(quantityHundredths) * BigInt(unitPriceCents), HUNDRED);
}

type ExactTotals = {
  lineBases: bigint[];
  breakdown: Array<{ vat_rate: VatRate; base: bigint; vat: bigint }>;
  subtotal: bigint;
  vatTotal: bigint;
  irpfTotal: bigint;
  total: bigint;
};

function assertValidLine(line: QuoteLineAmounts, index: number): void {
  const { quantity_hundredths: quantity, unit_price_cents: price, vat_rate } = line;
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY_HUNDREDTHS) {
    throw new RangeError(`Línea ${index}: cantidad fuera de rango (${quantity}).`);
  }
  if (!Number.isSafeInteger(price) || price < 0 || price > MAX_AMOUNT_CENTS) {
    throw new RangeError(`Línea ${index}: precio fuera de rango (${price}).`);
  }
  if (!isVatRate(vat_rate)) {
    throw new RangeError(`Línea ${index}: tipo de IVA no permitido (${vat_rate}).`);
  }
}

function assertValidIrpfRate(irpfRateHundredths: number): void {
  if (
    !Number.isSafeInteger(irpfRateHundredths) ||
    irpfRateHundredths < 0 ||
    irpfRateHundredths > MAX_IRPF_RATE_HUNDREDTHS
  ) {
    throw new RangeError(`Tipo de IRPF fuera de rango (${irpfRateHundredths}).`);
  }
}

function calculateExactTotals(
  lines: readonly QuoteLineAmounts[],
  irpfRateHundredths: number,
): ExactTotals {
  lines.forEach(assertValidLine);
  assertValidIrpfRate(irpfRateHundredths);

  const lineBases = lines.map((line) =>
    calculateLineBase(line.quantity_hundredths, line.unit_price_cents),
  );

  const breakdown = VAT_RATES.filter((rate) =>
    lines.some((line) => line.vat_rate === rate),
  ).map((rate) => {
    const base = lines.reduce(
      (sum, line, index) => (line.vat_rate === rate ? sum + lineBases[index] : sum),
      ZERO,
    );
    const vat = divideRoundHalfUp(base * BigInt(rate), HUNDRED);
    return { vat_rate: rate, base, vat };
  });

  const subtotal = lineBases.reduce((sum, base) => sum + base, ZERO);
  const vatTotal = breakdown.reduce((sum, entry) => sum + entry.vat, ZERO);
  const irpfTotal = divideRoundHalfUp(
    subtotal * BigInt(irpfRateHundredths),
    TEN_THOUSAND,
  );
  const total = subtotal + vatTotal - irpfTotal;

  return { lineBases, breakdown, subtotal, vatTotal, irpfTotal, total };
}

function exceedsColumn(value: bigint): boolean {
  return value > BigInt(MAX_AMOUNT_CENTS);
}

export function findAmountRangeIssue(
  lines: readonly QuoteLineAmounts[],
  irpfRateHundredths: number,
): AmountRangeIssue | null {
  return findRangeIssueIn(calculateExactTotals(lines, irpfRateHundredths));
}

function findRangeIssueIn(exact: ExactTotals): AmountRangeIssue | null {
  const lineIndex = exact.lineBases.findIndex(exceedsColumn);
  if (lineIndex !== -1) return { kind: "line_too_large", lineIndex };

  const headerAmounts = [
    ...exact.breakdown.flatMap((entry) => [entry.base, entry.vat]),
    exact.subtotal,
    exact.vatTotal,
    exact.irpfTotal,
    exact.total,
  ];
  if (headerAmounts.some(exceedsColumn)) return { kind: "total_too_large" };

  return null;
}

export function computeQuoteTotals<Line extends QuoteLineAmounts>(
  lines: readonly Line[],
  irpfRateHundredths: number,
): QuoteTotals<Line> {
  const exact = calculateExactTotals(lines, irpfRateHundredths);
  const issue = findRangeIssueIn(exact);
  if (issue) {
    throw new RangeError(
      issue.kind === "line_too_large"
        ? `La base de la línea ${issue.lineIndex} no cabe en numeric(12,2).`
        : "Algún total del presupuesto no cabe en numeric(12,2).",
    );
  }

  return {
    lines: lines.map((line, index) => ({
      ...line,
      base: bigintToSafeNumber(exact.lineBases[index]),
    })),
    vat_breakdown: exact.breakdown.map((entry) => ({
      vat_rate: entry.vat_rate,
      base: bigintToSafeNumber(entry.base),
      vat: bigintToSafeNumber(entry.vat),
    })),
    subtotal: bigintToSafeNumber(exact.subtotal),
    vat_total: bigintToSafeNumber(exact.vatTotal),
    irpf_total: bigintToSafeNumber(exact.irpfTotal),
    total: bigintToSafeNumber(exact.total),
  };
}
