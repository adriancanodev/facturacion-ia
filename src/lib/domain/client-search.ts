import { normalizeTaxId } from "./tax-id";

export const CLIENT_SEARCH_MAX_LENGTH = 100;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export function readClientSearchQuery(
  raw: string | string[] | undefined,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";

  const cleaned = value.replace(CONTROL_CHARACTERS, " ").trim();
  return Array.from(cleaned)
    .slice(0, CLIENT_SEARCH_MAX_LENGTH)
    .join("")
    .trimEnd();
}

export function toContainsLikePattern(text: string): string {
  const escaped = text.replace(/[\\%_]/g, "\\$&").replace(/\*/g, "_");
  return `%${escaped}%`;
}

export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

export function buildClientSearchFilter(query: string): string | null {
  if (query === "") return null;

  const pattern = quotePostgrestValue(toContainsLikePattern(query));
  const conditions = [
    `name.ilike.${pattern}`,
    `tax_id.ilike.${pattern}`,
    `email.ilike.${pattern}`,
  ];

  const normalizedTaxId = normalizeTaxId(query);
  if (
    normalizedTaxId !== "" &&
    normalizedTaxId !== query.toUpperCase()
  ) {
    conditions.push(
      `tax_id.ilike.${quotePostgrestValue(toContainsLikePattern(normalizedTaxId))}`,
    );
  }

  return conditions.join(",");
}
