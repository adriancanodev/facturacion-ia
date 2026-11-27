import { describe, expect, it } from "vitest";

import { formatIsoDate } from "@/lib/domain/date";

describe("formatIsoDate", () => {
  it("convierte AAAA-MM-DD en DD/MM/AAAA", () => {
    expect(formatIsoDate("2026-11-27")).toBe("27/11/2026");
  });

  it("conserva los ceros a la izquierda", () => {
    expect(formatIsoDate("2026-01-05")).toBe("05/01/2026");
  });

  it("no depende de la zona horaria en los límites del año", () => {
    expect(formatIsoDate("2025-12-31")).toBe("31/12/2025");
    expect(formatIsoDate("2026-01-01")).toBe("01/01/2026");
  });

  it.each(["", "27/11/2026", "2026-11-27T10:00:00Z", "2026-1-5", "texto"])(
    "rechaza un formato no válido: %j",
    (value) => {
      expect(() => formatIsoDate(value)).toThrow(RangeError);
    },
  );
});
