import { describe, expect, it } from "vitest";

import { IRPF_RATE_CHOICES, buildIrpfRateOptions } from "@/lib/domain/quote-irpf";

describe("buildIrpfRateOptions", () => {
  it("ofrece 0, 7 y 15 %", () => {
    expect(IRPF_RATE_CHOICES).toEqual(["0", "7", "15"]);
  });

  it("selecciona la opción fija que coincide", () => {
    expect(buildIrpfRateOptions("7")).toEqual({ options: ["0", "7", "15"], selected: "7" });
    expect(buildIrpfRateOptions("15")).toEqual({ options: ["0", "7", "15"], selected: "15" });
    expect(buildIrpfRateOptions("0")).toEqual({ options: ["0", "7", "15"], selected: "0" });
  });

  it("reconoce el mismo valor escrito de otra forma", () => {
    expect(buildIrpfRateOptions("7,00").selected).toBe("7");
    expect(buildIrpfRateOptions("15.0").selected).toBe("15");
    expect(buildIrpfRateOptions(" 0 ").selected).toBe("0");
  });

  it("vacío equivale a 0 %", () => {
    expect(buildIrpfRateOptions("")).toEqual({ options: ["0", "7", "15"], selected: "0" });
    expect(buildIrpfRateOptions("   ").selected).toBe("0");
  });

  it("añade un valor guardado que no es una opción fija para no perderlo", () => {
    expect(buildIrpfRateOptions("19")).toEqual({ options: ["0", "7", "15", "19"], selected: "19" });
    expect(buildIrpfRateOptions("7,5")).toEqual({ options: ["0", "7", "15", "7,5"], selected: "7,5" });
    expect(buildIrpfRateOptions("100")).toEqual({ options: ["0", "7", "15", "100"], selected: "100" });
  });

  it("conserva un valor no válido tal cual (el servidor mostrará el error)", () => {
    expect(buildIrpfRateOptions("abc")).toEqual({ options: ["0", "7", "15", "abc"], selected: "abc" });
    expect(buildIrpfRateOptions("150").selected).toBe("150");
  });
});
