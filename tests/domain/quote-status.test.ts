import { describe, expect, it } from "vitest";

import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  canTransition,
  isDeletable,
  isEditable,
  isQuoteStatus,
  nextStatuses,
  type QuoteStatus,
} from "@/lib/domain/quote-status";

const VALID_TRANSITIONS: Array<[QuoteStatus, QuoteStatus]> = [
  ["draft", "sent"],
  ["sent", "accepted"],
  ["sent", "rejected"],
];

describe("canTransition", () => {
  it.each(VALID_TRANSITIONS)("permite %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  // Todas las combinaciones que no están en la lista anterior son inválidas,
  // incluidas las de un estado a sí mismo y las de volver atrás.
  const invalidTransitions = QUOTE_STATUSES.flatMap((from) =>
    QUOTE_STATUSES.map((to): [QuoteStatus, QuoteStatus] => [from, to]),
  ).filter(([from, to]) => !VALID_TRANSITIONS.some(([f, t]) => f === from && t === to));

  it("hay 13 transiciones inválidas de 16 posibles", () => {
    expect(invalidTransitions).toHaveLength(13);
  });

  it.each(invalidTransitions)("no permite %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("nextStatuses", () => {
  it.each([
    ["draft", ["sent"]],
    ["sent", ["accepted", "rejected"]],
    ["accepted", []],
    ["rejected", []],
  ] as const)("desde %s → %j", (from, expected) => {
    expect(nextStatuses(from)).toEqual(expected);
  });
});

describe("isEditable e isDeletable", () => {
  it("solo el borrador se puede editar y borrar", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isDeletable("draft")).toBe(true);
  });

  it.each(["sent", "accepted", "rejected"] as const)("%s no se edita ni se borra", (status) => {
    expect(isEditable(status)).toBe(false);
    expect(isDeletable(status)).toBe(false);
  });
});

describe("isQuoteStatus", () => {
  it.each(QUOTE_STATUSES)("reconoce %s", (status) => {
    expect(isQuoteStatus(status)).toBe(true);
  });

  it.each(["", "Draft", "paid", "borrador"])("rechaza %j", (value) => {
    expect(isQuoteStatus(value)).toBe(false);
  });
});

describe("QUOTE_STATUS_LABELS", () => {
  it("tiene una etiqueta en español para cada estado", () => {
    expect(QUOTE_STATUS_LABELS).toEqual({
      draft: "Borrador",
      sent: "Enviado",
      accepted: "Aceptado",
      rejected: "Rechazado",
    });
  });
});
