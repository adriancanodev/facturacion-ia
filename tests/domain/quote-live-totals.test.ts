import { describe, expect, it } from "vitest";

import { MAX_AMOUNT_CENTS } from "@/lib/domain/money";
import {
  emptyQuoteFormValues,
  type QuoteFormValues,
  type QuoteLineFormValues,
} from "@/lib/domain/quote-form";
import { computeLiveQuoteTotals } from "@/lib/domain/quote-live-totals";
import { computeQuoteTotals } from "@/lib/domain/quote-totals";

function line(quantity: string, unitPrice: string, vatRate = "21", description = "Servicio"): QuoteLineFormValues {
  return { description, quantity, unit_price: unitPrice, vat_rate: vatRate };
}

function values(lines: QuoteLineFormValues[], irpfRate = "0"): QuoteFormValues {
  return { ...emptyQuoteFormValues(), irpf_rate: irpfRate, lines };
}

describe("líneas válidas", () => {
  it("coincide con computeQuoteTotals (el cálculo del servidor) con los 4 tipos de IVA e IRPF 15 %", () => {
    const live = computeLiveQuoteTotals(
      values(
        [
          line("3", "33,33", "21"),
          line("1,5", "10.01", "21"),
          line("2,5", "7,30", "10"),
          line("2", "12,50", "4"),
          line("1", "100", "0"),
        ],
        "15",
      ),
    );

    const server = computeQuoteTotals(
      [
        { quantity_hundredths: 300, unit_price_cents: 3333, vat_rate: 21 },
        { quantity_hundredths: 150, unit_price_cents: 1001, vat_rate: 21 },
        { quantity_hundredths: 250, unit_price_cents: 730, vat_rate: 10 },
        { quantity_hundredths: 200, unit_price_cents: 1250, vat_rate: 4 },
        { quantity_hundredths: 100, unit_price_cents: 10000, vat_rate: 0 },
      ],
      1500,
    );

    expect(live.lineBases).toEqual([9999, 1502, 1825, 2500, 10000]);
    expect(live.includedLineCount).toBe(5);
    expect(live.irpfRateHundredths).toBe(1500);
    expect(live.totalTooLarge).toBe(false);
    expect(live.summary).toEqual({
      vat_breakdown: server.vat_breakdown,
      subtotal: server.subtotal,
      vat_total: server.vat_total,
      irpf_total: server.irpf_total,
      total: server.total,
    });
    expect(live.summary?.subtotal).toBe(25826);
    expect(live.summary?.vat_total).toBe(2698);
    expect(live.summary?.irpf_total).toBe(3874);
    expect(live.summary?.total).toBe(24650);
  });

  it("redondea la base de la línea half-up (1,5 × 10,01 = 15,015 → 15,02)", () => {
    expect(computeLiveQuoteTotals(values([line("1,5", "10,01")])).lineBases).toEqual([1502]);
  });

  it("admite precio 0 (línea gratuita) y espacios alrededor", () => {
    const live = computeLiveQuoteTotals(values([line(" 2 ", " 0 ", " 21 ")]));
    expect(live.lineBases).toEqual([0]);
    expect(live.summary?.total).toBe(0);
  });

  it("la descripción no influye en el importe", () => {
    const live = computeLiveQuoteTotals(values([line("1", "10", "21", "")]));
    expect(live.lineBases).toEqual([1000]);
    expect(live.summary?.total).toBe(1210);
  });
});

describe("IRPF", () => {
  it("aplica el 7 % sobre la base", () => {
    const live = computeLiveQuoteTotals(values([line("1", "100")], "7"));
    expect(live.summary).toMatchObject({ subtotal: 10000, vat_total: 2100, irpf_total: 700, total: 11400 });
  });

  it("vacío equivale a 0 %", () => {
    const live = computeLiveQuoteTotals(values([line("1", "100")], ""));
    expect(live.irpfRateHundredths).toBe(0);
    expect(live.summary?.irpf_total).toBe(0);
  });

  it("acepta decimales con coma (7,5 %)", () => {
    const live = computeLiveQuoteTotals(values([line("1", "100")], "7,5"));
    expect(live.irpfRateHundredths).toBe(750);
    expect(live.summary?.irpf_total).toBe(750);
  });

  it("si no es válido, lo marca como null y calcula con 0 % sin lanzar", () => {
    for (const irpf of ["abc", "-7", "100,01", "7,555"]) {
      const live = computeLiveQuoteTotals(values([line("1", "100")], irpf));
      expect(live.irpfRateHundredths).toBeNull();
      expect(live.summary?.irpf_total).toBe(0);
      expect(live.summary?.total).toBe(12100);
    }
  });

  it("admite el límite del 100 %", () => {
    const live = computeLiveQuoteTotals(values([line("1", "100", "0")], "100"));
    expect(live.summary).toMatchObject({ irpf_total: 10000, total: 0 });
  });
});

describe("líneas incompletas o inválidas", () => {
  it("ignora las incompletas sin lanzar", () => {
    const live = computeLiveQuoteTotals(
      values([line("", ""), line("2", ""), line("", "10")]),
    );
    expect(live.lineBases).toEqual([null, null, null]);
    expect(live.includedLineCount).toBe(0);
    expect(live.summary).toBeNull();
    expect(live.totalTooLarge).toBe(false);
  });

  it("ignora cantidades y precios con formato no válido", () => {
    const invalid = [
      line("abc", "10"),
      line("1.234", "10"),
      line("1", "1.234,56"),
      line("-1", "10"),
      line("1", "-10"),
      line("1,555", "10"),
      line("1", "10,555"),
      line("0", "10"),
      line("1", "10", "7"),
      line("1", "10", ""),
    ];
    const live = computeLiveQuoteTotals(values(invalid));
    expect(live.lineBases).toEqual(invalid.map(() => null));
    expect(live.summary).toBeNull();
  });

  it("con mezcla, suma solo las válidas y conserva el orden de los importes", () => {
    const live = computeLiveQuoteTotals(
      values([line("2", "50", "21"), line("abc", "10"), line("1", "", "10"), line("1", "20", "10")]),
    );
    expect(live.lineBases).toEqual([10000, null, null, 2000]);
    expect(live.includedLineCount).toBe(2);
    expect(live.summary).toEqual({
      vat_breakdown: [
        { vat_rate: 21, base: 10000, vat: 2100 },
        { vat_rate: 10, base: 2000, vat: 200 },
      ],
      subtotal: 12000,
      vat_total: 2300,
      irpf_total: 0,
      total: 14300,
    });
  });

  it("sin líneas devuelve un resumen vacío", () => {
    const live = computeLiveQuoteTotals(values([]));
    expect(live).toEqual({
      lineBases: [],
      includedLineCount: 0,
      irpfRateHundredths: 0,
      summary: null,
      totalTooLarge: false,
    });
  });
});

describe("valores fuera de rango", () => {
  it("ignora una línea cuya base no cabe en numeric(12,2)", () => {
    const live = computeLiveQuoteTotals(
      values([line("9999999999,99", "9999999999,99"), line("1", "10")]),
    );
    expect(live.lineBases).toEqual([null, 1000]);
    expect(live.includedLineCount).toBe(1);
    expect(live.summary?.subtotal).toBe(1000);
  });

  it("ignora cantidades o precios por encima del máximo", () => {
    const live = computeLiveQuoteTotals(values([line("10000000000", "1"), line("1", "10000000000")]));
    expect(live.lineBases).toEqual([null, null]);
    expect(live.summary).toBeNull();
  });

  it("admite una línea justo en el máximo sin IVA", () => {
    const live = computeLiveQuoteTotals(values([line("1", "9999999999,99", "0")]));
    expect(live.lineBases).toEqual([MAX_AMOUNT_CENTS]);
    expect(live.summary?.total).toBe(MAX_AMOUNT_CENTS);
  });

  it("si el total no cabe, marca totalTooLarge y no da resumen, sin lanzar", () => {
    const live = computeLiveQuoteTotals(values([line("1", "9999999999,99", "21")]));
    expect(live.lineBases).toEqual([MAX_AMOUNT_CENTS]);
    expect(live.includedLineCount).toBe(1);
    expect(live.summary).toBeNull();
    expect(live.totalTooLarge).toBe(true);
  });
});
