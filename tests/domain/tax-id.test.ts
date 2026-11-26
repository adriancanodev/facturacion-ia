import { describe, expect, it } from "vitest";

import { isValidSpanishTaxIdFormat, normalizeTaxId } from "@/lib/domain/tax-id";

describe("normalizeTaxId", () => {
  it("quita espacios (también internos) y guiones y pasa a mayúsculas", () => {
    expect(normalizeTaxId(" b-7654 3219 ")).toBe("B76543219");
  });

  it("quita puntos y guiones de un NIF escrito con separadores", () => {
    expect(normalizeTaxId("12.345.678-z")).toBe("12345678Z");
  });

  it("quita tabuladores y saltos de línea", () => {
    expect(normalizeTaxId("\tx1234567l\n")).toBe("X1234567L");
  });

  it("no cambia un valor ya normalizado", () => {
    expect(normalizeTaxId("B76543219")).toBe("B76543219");
  });

  it("devuelve cadena vacía si solo hay separadores", () => {
    expect(normalizeTaxId(" .- ")).toBe("");
  });
});

describe("isValidSpanishTaxIdFormat", () => {
  describe("formatos válidos", () => {
    it.each([
      ["NIF (DNI)", "12345678Z"],
      ["NIF con ceros a la izquierda", "00000001R"],
      ["NIE con X", "X1234567L"],
      ["NIE con Y", "Y7654321G"],
      ["NIE con Z", "Z1234567R"],
      ["CIF con dígito de control", "B76543219"],
      ["CIF con letra de control", "Q2826000H"],
      ["CIF con control J (equivale a 0)", "P1234567J"],
      ["CIF de una sociedad anónima", "A58818501"],
      ["CIF de una entidad extranjera (N)", "N0012345A"],
      ["CIF de un establecimiento permanente (W)", "W1234567A"],
    ])("acepta %s: %s", (_label, taxId) => {
      expect(isValidSpanishTaxIdFormat(taxId)).toBe(true);
    });

    it.each(["B76543219", "12345678Z", "B87654328", "X1234567L", "Y7654321G"])(
      "acepta el tax_id del seed demo %s",
      (taxId) => {
        expect(isValidSpanishTaxIdFormat(taxId)).toBe(true);
      },
    );

    it("no comprueba la letra de control (D-B12): acepta un NIF con letra incorrecta", () => {
      expect(isValidSpanishTaxIdFormat("12345678A")).toBe(true);
    });
  });

  describe("formatos inválidos", () => {
    it.each([
      ["cadena vacía", ""],
      ["NIF con 7 dígitos", "1234567Z"],
      ["NIF con 9 dígitos", "123456789Z"],
      ["NIF sin letra", "12345678"],
      ["NIF con letra que no es de control (I)", "12345678I"],
      ["NIF con letra que no es de control (O)", "12345678O"],
      ["NIF con letra que no es de control (U)", "12345678U"],
      ["NIE con letra inicial incorrecta (W)", "W1234567L"],
      ["NIE con letra inicial incorrecta (A)", "A1234567T"],
      ["NIF especial con letra inicial K", "K1234567L"],
      ["NIF especial con letra inicial L", "L1234567S"],
      ["NIF especial con letra inicial M", "M1234567S"],
      ["NIE con 8 dígitos", "X12345678L"],
      ["NIE con 6 dígitos", "X123456L"],
      ["CIF con letra de entidad no válida (I)", "I1234567A"],
      ["CIF con letra de entidad no válida (O)", "O12345678"],
      ["CIF con letra de entidad no válida (T)", "T12345678"],
      ["CIF con control fuera de A-J (K)", "B1234567K"],
      ["CIF con 6 dígitos", "B123456A"],
      ["CIF con 8 dígitos", "B123456789"],
      ["sin normalizar (minúsculas)", "b76543219"],
      ["sin normalizar (con guion)", "B-76543219"],
      ["sin normalizar (con espacios)", " 12345678Z"],
      ["solo letras", "ABCDEFGHI"],
    ])("rechaza %s: %j", (_label, taxId) => {
      expect(isValidSpanishTaxIdFormat(taxId)).toBe(false);
    });
  });
});
