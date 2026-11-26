const CONTROL_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

const DNI_PATTERN = new RegExp(`^[0-9]{8}[${CONTROL_LETTERS}]$`);

const NIE_PATTERN = new RegExp(`^[XYZ][0-9]{7}[${CONTROL_LETTERS}]$`);

const CIF_PATTERN = /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/;

export function normalizeTaxId(raw: string): string {
  return raw.replace(/[\s.-]/g, "").toUpperCase();
}

export function isValidSpanishTaxIdFormat(taxId: string): boolean {
  return [DNI_PATTERN, NIE_PATTERN, CIF_PATTERN].some((pattern) =>
    pattern.test(taxId),
  );
}
