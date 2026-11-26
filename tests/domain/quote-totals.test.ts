import { describe, expect, it } from "vitest";

import { MAX_AMOUNT_CENTS, MAX_QUANTITY_HUNDREDTHS } from "@/lib/domain/money";
import {
  calculateLineBase,
  computeQuoteTotals,
  findAmountRangeIssue,
  isVatRate,
  type QuoteLineAmounts,
  type VatRate,
} from "@/lib/domain/quote-totals";

// Atajo para escribir líneas: cantidad en centésimas, precio en céntimos.
function line(quantityHundredths: number, unitPriceCents: number, vatRate: VatRate): QuoteLineAmounts {
  return {
    quantity_hundredths: quantityHundredths,
    unit_price_cents: unitPriceCents,
    vat_rate: vatRate,
  };
}

describe("ejemplo completo calculado a mano", () => {
  // Presupuesto con los 4 tipos de IVA e IRPF del 15 %:
  //
  //   Línea                     Cant. × Precio      Base exacta  → Base
  //   1. Diseño web (21 %)      3     × 33,33 €   = 99,99        → 99,99
  //   2. Hosting    (21 %)      1,5   × 10,01 €   = 15,015       → 15,02  (half-up)
  //   3. Catering   (10 %)      2,5   × 7,30 €    = 18,25        → 18,25
  //   4. Libro      (4 %)       2     × 12,50 €   = 25,00        → 25,00
  //   5. Formación  (0 %)       1     × 100,00 €  = 100,00       → 100,00
  //
  //   Desglose (la cuota se redondea UNA vez por tipo):
  //   21 %: base 99,99 + 15,02 = 115,01 → 115,01 × 21 % = 24,1521 → 24,15
  //   10 %: base 18,25                  → 18,25 × 10 %  = 1,825   → 1,83 (half-up)
  //    4 %: base 25,00                  → 25,00 × 4 %   = 1,00    → 1,00
  //    0 %: base 100,00                 → 0,00
  //
  //   Subtotal = 115,01 + 18,25 + 25,00 + 100,00 = 258,26
  //   IVA      = 24,15 + 1,83 + 1,00 + 0,00     = 26,98
  //   IRPF 15 % sobre 258,26 = 38,739           → 38,74
  //   Total    = 258,26 + 26,98 − 38,74          = 246,50 €
  const lines = [
    line(300, 3333, 21),
    line(150, 1001, 21),
    line(250, 730, 10),
    line(200, 1250, 4),
    line(100, 10000, 0),
  ];

  const totals = computeQuoteTotals(lines, 1500);

  it("calcula la base de cada línea", () => {
    expect(totals.lines.map((l) => l.base)).toEqual([9999, 1502, 1825, 2500, 10000]);
  });

  it("desglosa el IVA por tipo, en orden 21, 10, 4, 0", () => {
    expect(totals.vat_breakdown).toEqual([
      { vat_rate: 21, base: 11501, vat: 2415 },
      { vat_rate: 10, base: 1825, vat: 183 },
      { vat_rate: 4, base: 2500, vat: 100 },
      { vat_rate: 0, base: 10000, vat: 0 },
    ]);
  });

  it("calcula subtotal, IVA, IRPF y total", () => {
    expect(totals).toMatchObject({
      subtotal: 25826,
      vat_total: 2698,
      irpf_total: 3874,
      total: 24650,
    });
  });

  it("conserva los datos de cada línea junto a su base", () => {
    expect(totals.lines[0]).toEqual({ ...lines[0], base: 9999 });
  });
});

describe("sin errores de coma flotante", () => {
  it("0,10 + 0,20 = 0,30 exactos (en float: 0.30000000000000004)", () => {
    const totals = computeQuoteTotals([line(100, 10, 0), line(100, 20, 0)], 0);
    expect(totals.subtotal).toBe(30);
    expect(totals.total).toBe(30);
  });

  it("0,5 × 2,01 = 1,005 → 1,01 (en float Math.round(1.005 * 100) da 100)", () => {
    expect(calculateLineBase(50, 201)).toBe(BigInt(101));
  });

  it("tres líneas de 1,005 € suman 3,03 € (redondeo por línea, no al final)", () => {
    const totals = computeQuoteTotals(
      [line(50, 201, 0), line(50, 201, 0), line(50, 201, 0)],
      0,
    );
    expect(totals.lines.map((l) => l.base)).toEqual([101, 101, 101]);
    expect(totals.subtotal).toBe(303);
  });

  it("cuota de 18,25 € al 10 % = 1,825 → 1,83 (en float 1.825 * 100 = 182.49999…)", () => {
    expect(computeQuoteTotals([line(100, 1825, 10)], 0).vat_total).toBe(183);
  });
});

describe("base de línea (calculateLineBase)", () => {
  it("cantidad entera × precio", () => {
    expect(calculateLineBase(300, 1250)).toBe(BigInt(3750));
  });

  it("cantidades con 2 decimales: 0,33 × 10,00 € = 3,30 €", () => {
    expect(calculateLineBase(33, 1000)).toBe(BigInt(330));
  });

  it("1,5 × 10,01 € = 15,015 → 15,02 € (justo medio céntimo, half-up)", () => {
    expect(calculateLineBase(150, 1001)).toBe(BigInt(1502));
  });

  it("0,01 × 0,49 € = 0,0049 → 0,00 € (por debajo de medio céntimo)", () => {
    expect(calculateLineBase(1, 49)).toBe(BigInt(0));
  });

  it("0,01 × 0,50 € = 0,005 → 0,01 € (justo medio céntimo, half-up)", () => {
    expect(calculateLineBase(1, 50)).toBe(BigInt(1));
  });

  it("0,01 × 0,51 € = 0,0051 → 0,01 € (por encima de medio céntimo)", () => {
    expect(calculateLineBase(1, 51)).toBe(BigInt(1));
  });

  it("1,23 × 0,99 € = 1,2177 → 1,22 €", () => {
    expect(calculateLineBase(123, 99)).toBe(BigInt(122));
  });

  it("es exacta aunque el producto supere MAX_SAFE_INTEGER", () => {
    // 9.999.999.999,99 uds × 9.999.999.999,99 € → producto ≈ 10^24.
    const base = calculateLineBase(MAX_QUANTITY_HUNDREDTHS, MAX_AMOUNT_CENTS);
    const expected =
      (BigInt(MAX_QUANTITY_HUNDREDTHS) * BigInt(MAX_AMOUNT_CENTS) + BigInt(50)) / BigInt(100);
    expect(base).toBe(expected);
    expect(base > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });
});

describe("redondeo half-up de las cuotas", () => {
  it("2,50 € al 21 % = 0,525 → 0,53", () => {
    expect(computeQuoteTotals([line(100, 250, 21)], 0).vat_total).toBe(53);
  });

  it("2,49 € al 21 % = 0,5229 → 0,52", () => {
    expect(computeQuoteTotals([line(100, 249, 21)], 0).vat_total).toBe(52);
  });

  it("redondea una vez por tipo, no por línea", () => {
    // Dos líneas de 0,02 € al 21 %: por línea serían 0,0042 → 0 + 0 = 0,00;
    // por tipo, 0,04 × 21 % = 0,0084 → 0,01.
    const totals = computeQuoteTotals([line(100, 2, 21), line(100, 2, 21)], 0);
    expect(totals.vat_breakdown).toEqual([{ vat_rate: 21, base: 4, vat: 1 }]);
    expect(totals.vat_total).toBe(1);
  });
});

describe("tipos de IVA", () => {
  it.each([
    [21, 2100],
    [10, 1000],
    [4, 400],
    [0, 0],
  ] as const)("100,00 € al %i %% → cuota %i", (rate, expectedVat) => {
    const totals = computeQuoteTotals([line(100, 10000, rate)], 0);
    expect(totals.vat_total).toBe(expectedVat);
    expect(totals.total).toBe(10000 + expectedVat);
  });

  it("el desglose solo incluye los tipos usados, en orden 21, 10, 4, 0", () => {
    const totals = computeQuoteTotals([line(100, 100, 0), line(100, 100, 21)], 0);
    expect(totals.vat_breakdown.map((entry) => entry.vat_rate)).toEqual([21, 0]);
  });

  it("isVatRate solo acepta 0, 4, 10 y 21", () => {
    expect([0, 4, 10, 21].every(isVatRate)).toBe(true);
    expect([5, 7, 16, -21, 21.5].some(isVatRate)).toBe(false);
  });
});

describe("IRPF", () => {
  const lines = [line(100, 100000, 21)]; // 1.000,00 € al 21 %

  it.each([
    [0, 0, 121000],
    [700, 7000, 114000],
    [1500, 15000, 106000],
  ])("tipo %i (centésimas de %%) → IRPF %i y total %i", (rate, irpf, total) => {
    const totals = computeQuoteTotals(lines, rate);
    expect(totals.irpf_total).toBe(irpf);
    expect(totals.total).toBe(total);
  });

  it("admite decimales: 15,5 % de 1.000,00 € = 155,00 €", () => {
    expect(computeQuoteTotals(lines, 1550).irpf_total).toBe(15500);
  });

  it("se calcula sobre la base, no sobre base + IVA", () => {
    // Base 100,00 €, IVA 21,00 €; IRPF 15 % = 15,00 € (no 18,15 €).
    expect(computeQuoteTotals([line(100, 10000, 21)], 1500).irpf_total).toBe(1500);
  });

  it("redondeo half-up: 0,10 € al 15 % = 0,015 → 0,02", () => {
    expect(computeQuoteTotals([line(100, 10, 0)], 1500).irpf_total).toBe(2);
  });

  it("IRPF del 100 % deja como total solo el IVA", () => {
    const totals = computeQuoteTotals([line(100, 10000, 21)], 10000);
    expect(totals.irpf_total).toBe(10000);
    expect(totals.total).toBe(2100);
  });
});

describe("casos límite", () => {
  it("una sola línea a 0 € da todo a 0", () => {
    const totals = computeQuoteTotals([line(100, 0, 21)], 1500);
    expect(totals).toEqual({
      lines: [{ ...line(100, 0, 21), base: 0 }],
      vat_breakdown: [{ vat_rate: 21, base: 0, vat: 0 }],
      subtotal: 0,
      vat_total: 0,
      irpf_total: 0,
      total: 0,
    });
  });

  it("sin líneas devuelve todo a 0 (totales en vivo de un editor vacío)", () => {
    expect(computeQuoteTotals([], 1500)).toEqual({
      lines: [],
      vat_breakdown: [],
      subtotal: 0,
      vat_total: 0,
      irpf_total: 0,
      total: 0,
    });
  });

  it("el total máximo que cabe en numeric(12,2) se calcula sin desbordar", () => {
    const totals = computeQuoteTotals([line(100, MAX_AMOUNT_CENTS, 0)], 0);
    expect(totals.total).toBe(MAX_AMOUNT_CENTS);
    expect(findAmountRangeIssue([line(100, MAX_AMOUNT_CENTS, 0)], 0)).toBeNull();
  });

  it("cantidad máxima × precio pequeño cabe y es exacto", () => {
    // 9.999.999.999,99 uds × 0,01 € = 99.999.999,9999 € → 10.000.000.000 céntimos.
    const totals = computeQuoteTotals([line(MAX_QUANTITY_HUNDREDTHS, 1, 21)], 0);
    expect(totals.subtotal).toBe(10_000_000_000);
    expect(totals.vat_total).toBe(2_100_000_000);
  });
});

describe("importes que no caben en numeric(12,2)", () => {
  it("detecta la línea cuyo producto es demasiado grande (sin desbordar en silencio)", () => {
    const lines = [line(100, 100, 21), line(MAX_QUANTITY_HUNDREDTHS, MAX_AMOUNT_CENTS, 21)];
    expect(findAmountRangeIssue(lines, 0)).toEqual({ kind: "line_too_large", lineIndex: 1 });
    expect(() => computeQuoteTotals(lines, 0)).toThrow(RangeError);
  });

  it("detecta un total demasiado grande por el IVA", () => {
    const lines = [line(100, MAX_AMOUNT_CENTS, 21)];
    expect(findAmountRangeIssue(lines, 0)).toEqual({ kind: "total_too_large" });
    expect(() => computeQuoteTotals(lines, 0)).toThrow(RangeError);
  });

  it("detecta un subtotal demasiado grande por la suma de líneas", () => {
    const lines = [line(100, MAX_AMOUNT_CENTS, 0), line(100, 1, 0)];
    expect(findAmountRangeIssue(lines, 0)).toEqual({ kind: "total_too_large" });
  });
});

describe("entradas no válidas (errores de programación)", () => {
  it.each([
    ["cantidad 0", line(0, 100, 21)],
    ["cantidad negativa", line(-100, 100, 21)],
    ["cantidad con decimales", line(1.5, 100, 21)],
    ["cantidad por encima del máximo", line(MAX_QUANTITY_HUNDREDTHS + 1, 100, 21)],
    ["precio negativo", line(100, -1, 21)],
    ["precio con decimales", line(100, 0.1, 21)],
    ["precio por encima del máximo", line(100, MAX_AMOUNT_CENTS + 1, 21)],
    ["IVA no permitido", { ...line(100, 100, 21), vat_rate: 16 as VatRate }],
  ])("lanza RangeError con %s", (_name, invalidLine) => {
    expect(() => computeQuoteTotals([invalidLine], 0)).toThrow(RangeError);
  });

  it.each([-1, 10001, 15.5])("lanza RangeError con IRPF %j", (rate) => {
    expect(() => computeQuoteTotals([line(100, 100, 21)], rate)).toThrow(RangeError);
  });
});
