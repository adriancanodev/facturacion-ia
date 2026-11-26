import { z } from "zod";

import { isValidSpanishTaxIdFormat, normalizeTaxId } from "./tax-id";

export const CLIENT_NAME_MAX_LENGTH = 200;
export const CLIENT_ADDRESS_MAX_LENGTH = 300;
export const CLIENT_EMAIL_MAX_LENGTH = 200;
export const CLIENT_PHONE_MAX_LENGTH = 30;

const PHONE_PATTERN = /^\+?[0-9 ()-]*[0-9][0-9 ()-]*$/;

function emptyToNull(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

export const clientInputSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio." })
    .trim()
    .min(1, { error: "El nombre es obligatorio." })
    .max(CLIENT_NAME_MAX_LENGTH, {
      error: `El nombre no puede superar los ${CLIENT_NAME_MAX_LENGTH} caracteres.`,
    }),

  tax_id: z
    .string({ error: "El NIF/CIF es obligatorio." })
    .overwrite(normalizeTaxId)
    .min(1, { error: "El NIF/CIF es obligatorio.", abort: true })
    .refine(isValidSpanishTaxIdFormat, {
      error:
        "El NIF/CIF no tiene un formato válido. Ejemplos: 12345678Z (NIF), X1234567L (NIE) o B12345678 (CIF).",
    }),

  address: z
    .string({ error: "La dirección es obligatoria." })
    .trim()
    .min(1, { error: "La dirección es obligatoria." })
    .max(CLIENT_ADDRESS_MAX_LENGTH, {
      error: `La dirección no puede superar los ${CLIENT_ADDRESS_MAX_LENGTH} caracteres.`,
    }),

  email: z
    .string({ error: "El email no es válido." })
    .trim()
    .optional()
    .transform(emptyToNull)
    .pipe(
      z
        .email({ error: "El email no es válido. Ejemplo: nombre@empresa.es" })
        .max(CLIENT_EMAIL_MAX_LENGTH, {
          error: `El email no puede superar los ${CLIENT_EMAIL_MAX_LENGTH} caracteres.`,
        })
        .nullable(),
    ),

  phone: z
    .string({ error: "El teléfono no es válido." })
    .trim()
    .optional()
    .transform(emptyToNull)
    .pipe(
      z
        .string()
        .max(CLIENT_PHONE_MAX_LENGTH, {
          error: `El teléfono no puede superar los ${CLIENT_PHONE_MAX_LENGTH} caracteres.`,
        })
        .regex(PHONE_PATTERN, {
          error:
            "El teléfono solo puede tener números, espacios, guiones, paréntesis y un + inicial.",
        })
        .nullable(),
    ),
});

export type ClientInput = z.output<typeof clientInputSchema>;
