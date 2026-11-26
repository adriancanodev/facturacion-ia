import { describe, expect, it } from "vitest";

import {
  MAX_AMOUNT_CENTS,
  MAX_QUANTITY_HUNDREDTHS,
  bigintToSafeNumber,
  divideRoundHalfUp,
  formatCents,
  parseDecimalToHundredths,
  toDecimalString,
} from "@/lib/domain/money";

const parseCents = (text: string) => parseDecimalToHundredths(text, MAX_AMOUNT_CENTS);
const parseQuantity = (text: string) => parseDecimalToHundredths(text, MAX_QUANTITY_HUNDREDTHS);

describe("parseDecimalToHundredths", () => {
  describe("textos válidos", () => {
    it.each([
      ["12", 1200],
      ["12,5", 1250],
      ["12.5", 1250],
      ["12,50", 1250],
      ["0,01", 1],
      ["0", 0],
      ["0,00", 0],
      ["007,10", 710],
      ["  3,99  ", 399],
    ])("precio %j → %i céntimos", (text, expected) => {
      expect(parseCents(text)).toEqual({ ok: true, value: expected });
    });

    it.each([
      ["1", 100],
      ["1,5", 150],
      ["0,33", 33],
      ["0.01", 1],
      ["2,25", 225],
    ])("cantidad %j → %i centésimas", (text, expected) => {
      expect(parseQuantity(text)).toEqual({ ok: true, value: expected });
    });

    it("no pasa por coma flotante: 0,29 son exactamente 29 céntimos", () => {
      // En float, 0.29 * 100 = 28.999999999999996.
      expect(parseCents("0,29")).toEqual({ ok: true, value: 29 });
    });

    it("acepta exactamente el máximo de cada columna", () => {
      expect(parseCents("9999999999,99")).toEqual({ ok: true, value: MAX_AMOUNT_CENTS });
      expect(parseQuantity("9999999999,99")).toEqual({
        ok: true,
        value: MAX_QUANTITY_HUNDREDTHS,
      });
    });
  });

  describe("textos inválidos", () => {
    it.each(["", "   "])("vacío %j", (text) => {
      expect(parseCents(text)).toEqual({ ok: false, error: "empty" });
    });

    it.each(["abc", "1,2,3", "1.234,56", "1 000", ",5", "12,", "+5", "1e3", "12€", "--1", "١٢"])(
      "no numérico %j",
      (text) => {
        expect(parseCents(text)).toEqual({ ok: false, error: "invalid" });
      },
    );

    it.each(["-1", "-0,5", " -3 "])("negativo %j", (text) => {
      expect(parseCents(text)).toEqual({ ok: false, error: "negative" });
    });

    it("demasiados decimales en precio (más de 2)", () => {
      expect(parseCents("1,005")).toEqual({ ok: false, error: "too_many_decimals" });
    });

    it.each(["1,005", "0,333", "1.234"])("demasiados decimales en cantidad (más de 2) %j", (text) => {
      // "1.234" no se lee como mil doscientos: el punto es decimal y sobran cifras.
      expect(parseQuantity(text)).toEqual({ ok: false, error: "too_many_decimals" });
    });

    it("por encima del máximo de la columna", () => {
      expect(parseCents("10000000000")).toEqual({ ok: false, error: "too_large" });
      expect(parseQuantity("10000000000")).toEqual({ ok: false, error: "too_large" });
    });

    it("un número enorme no pierde precisión ni se cuela", () => {
      expect(parseCents("99999999999999999999999")).toEqual({ ok: false, error: "too_large" });
    });
  });
});

describe("divideRoundHalfUp", () => {
  const b = (value: number) => BigInt(value);

  it("redondea hacia abajo por debajo de la mitad", () => {
    expect(divideRoundHalfUp(b(1049), b(100))).toBe(b(10));
  });

  it("redondea hacia arriba justo en la mitad (half-up)", () => {
    expect(divideRoundHalfUp(b(1050), b(100))).toBe(b(11));
    expect(divideRoundHalfUp(b(5), b(10))).toBe(b(1));
  });

  it("redondea hacia arriba por encima de la mitad", () => {
    expect(divideRoundHalfUp(b(1051), b(100))).toBe(b(11));
  });

  it("divisiones exactas y cero", () => {
    expect(divideRoundHalfUp(b(1000), b(100))).toBe(b(10));
    expect(divideRoundHalfUp(b(0), b(1000))).toBe(b(0));
  });

  it("rechaza negativos y división entre cero", () => {
    expect(() => divideRoundHalfUp(b(-5), b(10))).toThrow(RangeError);
    expect(() => divideRoundHalfUp(b(5), b(0))).toThrow(RangeError);
  });
});

describe("bigintToSafeNumber", () => {
  it("convierte enteros exactos", () => {
    expect(bigintToSafeNumber(BigInt(MAX_AMOUNT_CENTS))).toBe(MAX_AMOUNT_CENTS);
    expect(bigintToSafeNumber(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("lanza si el entero perdería precisión", () => {
    expect(() => bigintToSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1))).toThrow(
      RangeError,
    );
  });
});

describe("toDecimalString", () => {
  it.each([
    [1250, "12.50"],
    [150, "1.50"],
    [5, "0.05"],
    [0, "0.00"],
    [MAX_AMOUNT_CENTS, "9999999999.99"],
    [-1250, "-12.50"],
  ])("%i centésimas → %j", (value, expected) => {
    expect(toDecimalString(value)).toBe(expected);
  });

  it("rechaza valores no enteros", () => {
    expect(() => toDecimalString(12.5)).toThrow(RangeError);
  });
});

describe("formatCents", () => {
  it.each([
    [0, "0,00 €"],
    [5, "0,05 €"],
    [1250, "12,50 €"],
    [123456, "1.234,56 €"],
    [100000000, "1.000.000,00 €"],
    [MAX_AMOUNT_CENTS, "9.999.999.999,99 €"],
    [-123456, "-1.234,56 €"],
  ])("%i céntimos → %j", (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it("rechaza importes no enteros", () => {
    expect(() => formatCents(0.1)).toThrow(RangeError);
  });
});
