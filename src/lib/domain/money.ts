export type Cents = number;
export type Hundredths = number;

export const DECIMAL_PLACES = 2;

export const MAX_AMOUNT_CENTS: Cents = 999_999_999_999;
export const MAX_QUANTITY_HUNDREDTHS: Hundredths = 999_999_999_999;

export type DecimalParseError =
  | "empty"
  | "invalid"
  | "negative"
  | "too_many_decimals"
  | "too_large";

export type DecimalParseResult =
  | { ok: true; value: number }
  | { ok: false; error: DecimalParseError };

const DECIMAL_PATTERN = /^(\d+)(?:[.,](\d+))?$/;

export function parseDecimalToHundredths(text: string, maxValue: number): DecimalParseResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, error: "empty" };

  if (trimmed.startsWith("-") && DECIMAL_PATTERN.test(trimmed.slice(1))) {
    return { ok: false, error: "negative" };
  }

  const match = DECIMAL_PATTERN.exec(trimmed);
  if (!match) return { ok: false, error: "invalid" };

  const integerPart = match[1];
  const fractionPart = match[2] ?? "";
  if (fractionPart.length > DECIMAL_PLACES) {
    return { ok: false, error: "too_many_decimals" };
  }

  const scaled = BigInt(integerPart + fractionPart.padEnd(DECIMAL_PLACES, "0"));
  if (scaled > BigInt(maxValue)) return { ok: false, error: "too_large" };

  return { ok: true, value: bigintToSafeNumber(scaled) };
}

export function bigintToSafeNumber(value: bigint): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new RangeError(`El entero ${value} no se puede representar con exactitud.`);
  }
  return Number(value);
}

export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const zero = BigInt(0);
  if (numerator < zero || denominator <= zero) {
    throw new RangeError("Solo se admiten numerador ≥ 0 y denominador > 0.");
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;
}

function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} debe ser un entero exacto (recibido: ${value}).`);
  }
}

export function toDecimalString(value: number): string {
  assertSafeInteger(value, "El valor");
  const sign = value < 0 ? "-" : "";
  const digits = Math.abs(value).toString().padStart(DECIMAL_PLACES + 1, "0");
  return `${sign}${digits.slice(0, -DECIMAL_PLACES)}.${digits.slice(-DECIMAL_PLACES)}`;
}

export function formatCents(cents: Cents): string {
  assertSafeInteger(cents, "El importe");
  const [integerPart, fractionPart] = toDecimalString(Math.abs(cents)).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = cents < 0 ? "-" : "";
  return `${sign}${grouped},${fractionPart} €`;
}
