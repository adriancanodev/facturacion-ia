import { describe, expect, it } from "vitest";

import {
  buildQuoteSummary,
  type StoredQuoteAmounts,
  type StoredQuoteLineAmounts,
} from "@/lib/domain/quote-summary";

function header(overrides: Partial<StoredQuoteAmounts> = {}): StoredQuoteAmounts {
  return {
    irpf_rate: 0,
    subtotal: 0,
    vat_total: 0,
    irpf_total: 0,
    total: 0,
    ...overrides,
  };
}

describe("buildQuoteSummary: totales guardados", () => {
  it("pasa los numeric de cabecera a céntimos sin floats", () => {
    const summary = buildQuoteSummary(
      header({ subtotal: 1000.1, vat_total: 210.02, irpf_total: 150.02, total: 1060.1, irpf_rate: 15 }),
      [{ quantity: 1, unit_price: 1000.1, vat_rate: 21 }],
    );
    expect(summary).toMatchObject({
      subtotal: 100010,
      vatTotal: 21002,
      irpfTotal: 15002,
      total: 106010,
      irpfRateHundredths: 1500,
    });
  });

  it("admite IRPF con decimales", () => {
    const summary = buildQuoteSummary(header({ irpf_rate: 7.5 }), []);
    expect(summary.irpfRateHundredths).toBe(750);
  });

  it("todo a cero", () => {
    const summary = buildQuoteSummary(header(), [{ quantity: 1, unit_price: 0, vat_rate: 21 }]);
    expect(summary).toEqual({
      subtotal: 0,
      vatTotal: 0,
      irpfRateHundredths: 0,
      irpfTotal: 0,
      total: 0,
      vatBreakdown: [{ vat_rate: 21, base: 0, vat: 0 }],
    });
  });
});

describe("buildQuoteSummary: desglose de IVA recalculado", () => {
  const mixedLines: StoredQuoteLineAmounts[] = [
    { quantity: 2, unit_price: 100, vat_rate: 21 },
    { quantity: 1.5, unit_price: 33.33, vat_rate: 10 },
    { quantity: 3, unit_price: 10, vat_rate: 4 },
    { quantity: 1, unit_price: 50, vat_rate: 0 },
    { quantity: 1, unit_price: 100, vat_rate: 21 },
  ];

  it("agrupa por tipo, solo los usados, en el orden 21/10/4/0", () => {
    // Bases: 21 % → 300,00; 10 % → 1,5 × 33,33 = 49,995 → 50,00; 4 % → 30,00; 0 % → 50,00.
    const summary = buildQuoteSummary(header({ vat_total: 69.2 }), mixedLines);
    expect(summary.vatBreakdown).toEqual([
      { vat_rate: 21, base: 30000, vat: 6300 },
      { vat_rate: 10, base: 5000, vat: 500 },
      { vat_rate: 4, base: 3000, vat: 120 },
      { vat_rate: 0, base: 5000, vat: 0 },
    ]);
  });

  it("solo incluye los tipos presentes", () => {
    const summary = buildQuoteSummary(header({ vat_total: 1 }), [
      { quantity: 1, unit_price: 10, vat_rate: 10 },
    ]);
    expect(summary.vatBreakdown).toEqual([{ vat_rate: 10, base: 1000, vat: 100 }]);
  });

  it("redondea el IVA de cada tipo half-up", () => {
    // 2,50 × 21 % = 0,525 → 0,53.
    const summary = buildQuoteSummary(header({ vat_total: 0.53 }), [
      { quantity: 1, unit_price: 2.5, vat_rate: 21 },
    ]);
    expect(summary.vatBreakdown).toEqual([{ vat_rate: 21, base: 250, vat: 53 }]);
  });

  it("la suma del desglose coincide con vat_total guardado", () => {
    const summary = buildQuoteSummary(header({ vat_total: 69.2 }), mixedLines);
    const sum = (summary.vatBreakdown ?? []).reduce((acc, entry) => acc + entry.vat, 0);
    expect(sum).toBe(summary.vatTotal);
  });
});

describe("buildQuoteSummary: datos que no cuadran", () => {
  it("si el IVA recalculado no coincide con el guardado, no hay desglose", () => {
    const summary = buildQuoteSummary(header({ vat_total: 21.01 }), [
      { quantity: 1, unit_price: 100, vat_rate: 21 },
    ]);
    expect(summary.vatBreakdown).toBeNull();
    expect(summary.vatTotal).toBe(2101);
  });

  it("sin líneas no hay desglose", () => {
    expect(buildQuoteSummary(header(), []).vatBreakdown).toBeNull();
  });

  it("un tipo de IVA no permitido no rompe: no hay desglose", () => {
    const summary = buildQuoteSummary(header({ vat_total: 7 }), [
      { quantity: 1, unit_price: 100, vat_rate: 7 },
    ]);
    expect(summary.vatBreakdown).toBeNull();
  });

  it("una cantidad no válida para el dominio no rompe: no hay desglose", () => {
    const summary = buildQuoteSummary(header(), [{ quantity: 0, unit_price: 100, vat_rate: 21 }]);
    expect(summary.vatBreakdown).toBeNull();
  });

  it("una cantidad con más de 2 decimales no rompe: no hay desglose", () => {
    const summary = buildQuoteSummary(header(), [{ quantity: 1.005, unit_price: 1, vat_rate: 21 }]);
    expect(summary.vatBreakdown).toBeNull();
  });

  it("un total de cabecera no representable lanza RangeError", () => {
    expect(() => buildQuoteSummary(header({ total: 1.005 }), [])).toThrow(RangeError);
  });
});
