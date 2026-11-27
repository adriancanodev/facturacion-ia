import { describe, expect, it } from "vitest";

import { BUSINESS_TIME_ZONE, formatIsoDate, isoDateInTimeZone } from "@/lib/domain/date";

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

describe("isoDateInTimeZone", () => {
  it("usa Europe/Madrid como zona del negocio", () => {
    expect(BUSINESS_TIME_ZONE).toBe("Europe/Madrid");
  });

  it("a mediodía UTC coincide con la fecha UTC", () => {
    expect(isoDateInTimeZone(new Date("2026-11-27T12:00:00Z"), BUSINESS_TIME_ZONE)).toBe("2026-11-27");
  });

  it("en invierno (UTC+1), las 23:30 UTC ya son el día siguiente en Madrid", () => {
    expect(isoDateInTimeZone(new Date("2026-01-14T23:30:00Z"), BUSINESS_TIME_ZONE)).toBe("2026-01-15");
    expect(isoDateInTimeZone(new Date("2026-01-14T22:59:59Z"), BUSINESS_TIME_ZONE)).toBe("2026-01-14");
  });

  it("en verano (UTC+2), las 22:00 UTC ya son el día siguiente en Madrid", () => {
    expect(isoDateInTimeZone(new Date("2026-07-31T22:00:00Z"), BUSINESS_TIME_ZONE)).toBe("2026-08-01");
    expect(isoDateInTimeZone(new Date("2026-07-31T21:59:59Z"), BUSINESS_TIME_ZONE)).toBe("2026-07-31");
  });

  it("cambia de año en Nochevieja", () => {
    expect(isoDateInTimeZone(new Date("2026-12-31T23:00:00Z"), BUSINESS_TIME_ZONE)).toBe("2027-01-01");
  });

  it("respeta otras zonas (no depende de la del proceso)", () => {
    const instant = new Date("2026-03-01T03:00:00Z");
    expect(isoDateInTimeZone(instant, "UTC")).toBe("2026-03-01");
    expect(isoDateInTimeZone(instant, "America/New_York")).toBe("2026-02-28");
  });

  it("lanza RangeError con un instante o una zona no válidos", () => {
    expect(() => isoDateInTimeZone(new Date("no es fecha"), BUSINESS_TIME_ZONE)).toThrow(RangeError);
    expect(() => isoDateInTimeZone(new Date(), "Zona/Inventada")).toThrow(RangeError);
  });
});
