import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  CLIENT_ADDRESS_MAX_LENGTH,
  CLIENT_EMAIL_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  CLIENT_PHONE_MAX_LENGTH,
  clientInputSchema,
  type ClientInput,
} from "@/lib/domain/client";
import type { TablesInsert } from "@/types/database";

// Datos válidos de partida: cada test cambia solo el campo que le interesa.
const validInput = {
  name: "Talleres Imaginarios del Norte S.L.",
  tax_id: "B76543219",
  address: "Calle Inventada 12, 48001 Bilbao (Bizkaia)",
  email: "administracion@talleres-imaginarios.example",
  phone: "+34 600 000 001",
};

// Mensajes de error de un campo concreto, como los mostrará el formulario.
function fieldErrors(input: unknown, field: keyof ClientInput): string[] {
  const result = clientInputSchema.safeParse(input);
  if (result.success) return [];
  return z.flattenError(result.error).fieldErrors[field] ?? [];
}

describe("clientInputSchema", () => {
  describe("datos válidos", () => {
    it("acepta un cliente completo y devuelve los datos tal cual", () => {
      expect(clientInputSchema.parse(validInput)).toEqual(validInput);
    });

    it("recorta espacios en nombre, dirección, email y teléfono", () => {
      const result = clientInputSchema.parse({
        name: "  Laura Gómez  ",
        tax_id: "12345678Z",
        address: "  Avenida de la Prueba 5  ",
        email: "  laura@ejemplo.es  ",
        phone: "  600 000 002  ",
      });
      expect(result).toEqual({
        name: "Laura Gómez",
        tax_id: "12345678Z",
        address: "Avenida de la Prueba 5",
        email: "laura@ejemplo.es",
        phone: "600 000 002",
      });
    });

    it("normaliza el tax_id antes de validarlo", () => {
      const result = clientInputSchema.parse({ ...validInput, tax_id: " b-7654 3219 " });
      expect(result.tax_id).toBe("B76543219");
    });

    it("convierte email y teléfono vacíos en null", () => {
      const result = clientInputSchema.parse({ ...validInput, email: "", phone: "" });
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
    });

    it("convierte email y teléfono con solo espacios en null", () => {
      const result = clientInputSchema.parse({ ...validInput, email: "   ", phone: "   " });
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
    });

    it("convierte en null email y teléfono que no llegan (campo ausente del FormData)", () => {
      const result = clientInputSchema.parse({
        name: validInput.name,
        tax_id: validInput.tax_id,
        address: validInput.address,
      });
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
    });

    it.each(["+34 (91) 123-45-67", "600000000", "91 123 45 67", "1"])(
      "acepta el teléfono %s y lo guarda con su formato",
      (phone) => {
        expect(clientInputSchema.parse({ ...validInput, phone }).phone).toBe(phone);
      },
    );

    it("descarta campos que no son del esquema (p. ej. los que añade Next al FormData)", () => {
      const result = clientInputSchema.parse({ ...validInput, $ACTION_ID_abc: "", user_id: "x" });
      expect(result).toEqual(validInput);
    });

    it("funciona con Object.fromEntries(formData), como en las Server Actions", () => {
      const formData = new FormData();
      formData.set("name", "Marco Rossi Demo");
      formData.set("tax_id", "x-1234567-l");
      formData.set("address", "Carrer Fictici 27, 08001 Barcelona");
      formData.set("email", "");
      formData.set("phone", "+34 600 000 004");

      expect(clientInputSchema.parse(Object.fromEntries(formData))).toEqual({
        name: "Marco Rossi Demo",
        tax_id: "X1234567L",
        address: "Carrer Fictici 27, 08001 Barcelona",
        email: null,
        phone: "+34 600 000 004",
      });
    });
  });

  describe("clientes del seed demo", () => {
    // Deben pasar la validación: si no, el usuario no podría editarlos.
    it.each([
      {
        name: "Talleres Imaginarios del Norte S.L.",
        tax_id: "B76543219",
        address: "Calle Inventada 12, 48001 Bilbao (Bizkaia)",
        email: "administracion@talleres-imaginarios.example",
        phone: "+34 600 000 001",
      },
      {
        name: "Laura Gómez Ejemplo",
        tax_id: "12345678Z",
        address: "Avenida de la Prueba 5, 3º B, 46001 Valencia",
        email: "laura.gomez@estudio-ejemplo.example",
        phone: null,
      },
      {
        name: "Panadería La Espiga Ficticia S.L.",
        tax_id: "B87654328",
        address: "Plaza Supuesta 3, 41001 Sevilla",
        email: null,
        phone: "+34 600 000 003",
      },
      {
        name: "Marco Rossi Demo",
        tax_id: "X1234567L",
        address: "Carrer Fictici 27, 08001 Barcelona",
        email: "marco.rossi@traducciones-demo.example",
        phone: "+34 600 000 004",
      },
      {
        name: "Elena Petrova Muestra",
        tax_id: "Y7654321G",
        address: "Calle del Simulacro 8, 50001 Zaragoza",
        email: "elena@fotografia-muestra.example",
        phone: "+34 600 000 005",
      },
    ])("acepta $tax_id ($name)", (client) => {
      // En el formulario de edición los null de la BD llegan como "".
      const asForm = { ...client, email: client.email ?? "", phone: client.phone ?? "" };
      expect(clientInputSchema.parse(asForm)).toEqual(client);
    });
  });

  describe("nombre", () => {
    it("rechaza un nombre vacío", () => {
      expect(fieldErrors({ ...validInput, name: "" }, "name")).toEqual([
        "El nombre es obligatorio.",
      ]);
    });

    it("rechaza un nombre con solo espacios", () => {
      expect(fieldErrors({ ...validInput, name: "   " }, "name")).toEqual([
        "El nombre es obligatorio.",
      ]);
    });

    it("rechaza un nombre ausente", () => {
      const { name: _name, ...withoutName } = validInput;
      expect(fieldErrors(withoutName, "name")).toEqual(["El nombre es obligatorio."]);
    });

    it("acepta un nombre justo en el límite", () => {
      const name = "a".repeat(CLIENT_NAME_MAX_LENGTH);
      expect(clientInputSchema.parse({ ...validInput, name }).name).toBe(name);
    });

    it("cuenta la longitud después de recortar los espacios", () => {
      const name = ` ${"a".repeat(CLIENT_NAME_MAX_LENGTH)} `;
      expect(clientInputSchema.safeParse({ ...validInput, name }).success).toBe(true);
    });

    it("rechaza un nombre que se pasa del límite", () => {
      const name = "a".repeat(CLIENT_NAME_MAX_LENGTH + 1);
      expect(fieldErrors({ ...validInput, name }, "name")).toEqual([
        "El nombre no puede superar los 200 caracteres.",
      ]);
    });
  });

  describe("NIF/CIF", () => {
    it("rechaza un tax_id vacío con un único mensaje", () => {
      expect(fieldErrors({ ...validInput, tax_id: "" }, "tax_id")).toEqual([
        "El NIF/CIF es obligatorio.",
      ]);
    });

    it("rechaza un tax_id que solo tiene separadores", () => {
      expect(fieldErrors({ ...validInput, tax_id: " - . " }, "tax_id")).toEqual([
        "El NIF/CIF es obligatorio.",
      ]);
    });

    it("rechaza un tax_id con formato inválido", () => {
      const errors = fieldErrors({ ...validInput, tax_id: "1234567Z" }, "tax_id");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^El NIF\/CIF no tiene un formato válido/);
    });

    it("rechaza un CIF con letra de entidad no válida", () => {
      expect(fieldErrors({ ...validInput, tax_id: "I1234567A" }, "tax_id")).toHaveLength(1);
    });
  });

  describe("dirección", () => {
    it("rechaza una dirección con solo espacios", () => {
      expect(fieldErrors({ ...validInput, address: "  " }, "address")).toEqual([
        "La dirección es obligatoria.",
      ]);
    });

    it("acepta una dirección justo en el límite", () => {
      const address = "a".repeat(CLIENT_ADDRESS_MAX_LENGTH);
      expect(clientInputSchema.safeParse({ ...validInput, address }).success).toBe(true);
    });

    it("rechaza una dirección que se pasa del límite", () => {
      const address = "a".repeat(CLIENT_ADDRESS_MAX_LENGTH + 1);
      expect(fieldErrors({ ...validInput, address }, "address")).toEqual([
        "La dirección no puede superar los 300 caracteres.",
      ]);
    });
  });

  describe("email", () => {
    it.each(["no-es-un-email", "falta@dominio", "@ejemplo.es", "con espacio@ejemplo.es"])(
      "rechaza un email inválido: %s",
      (email) => {
        expect(fieldErrors({ ...validInput, email }, "email")).toEqual([
          "El email no es válido. Ejemplo: nombre@empresa.es",
        ]);
      },
    );

    // Un email de exactamente N caracteres: local@ + dominio de relleno + .es
    function emailOfLength(length: number): string {
      const suffix = "@ejemplo.es";
      return `${"a".repeat(length - suffix.length)}${suffix}`;
    }

    it("acepta un email justo en el límite", () => {
      const email = emailOfLength(CLIENT_EMAIL_MAX_LENGTH);
      expect(email).toHaveLength(CLIENT_EMAIL_MAX_LENGTH);
      expect(clientInputSchema.parse({ ...validInput, email }).email).toBe(email);
    });

    it("rechaza un email que se pasa del límite", () => {
      const email = emailOfLength(CLIENT_EMAIL_MAX_LENGTH + 1);
      expect(fieldErrors({ ...validInput, email }, "email")).toContain(
        "El email no puede superar los 200 caracteres.",
      );
    });
  });

  describe("teléfono", () => {
    it.each(["abc", "600-000-00a", "+", "()", "600+000", "600.000.000"])(
      "rechaza un teléfono con formato inválido: %s",
      (phone) => {
        expect(fieldErrors({ ...validInput, phone }, "phone")).toEqual([
          "El teléfono solo puede tener números, espacios, guiones, paréntesis y un + inicial.",
        ]);
      },
    );

    it("acepta un teléfono justo en el límite", () => {
      const phone = "6".repeat(CLIENT_PHONE_MAX_LENGTH);
      expect(clientInputSchema.parse({ ...validInput, phone }).phone).toBe(phone);
    });

    it("rechaza un teléfono que se pasa del límite", () => {
      const phone = "6".repeat(CLIENT_PHONE_MAX_LENGTH + 1);
      expect(fieldErrors({ ...validInput, phone }, "phone")).toEqual([
        "El teléfono no puede superar los 30 caracteres.",
      ]);
    });
  });

  describe("entradas que no son texto", () => {
    it("rechaza valores que no son texto con mensajes en español", () => {
      const result = clientInputSchema.safeParse({
        name: 1,
        tax_id: null,
        address: {},
        email: 3,
        phone: true,
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(z.flattenError(result.error).fieldErrors).toEqual({
        name: ["El nombre es obligatorio."],
        tax_id: ["El NIF/CIF es obligatorio."],
        address: ["La dirección es obligatoria."],
        email: ["El email no es válido."],
        phone: ["El teléfono no es válido."],
      });
    });
  });

  describe("tipos", () => {
    it("el resultado encaja con el insert de clients (sin id ni user_id)", () => {
      type ClientInsert = Omit<
        TablesInsert<"clients">,
        "id" | "user_id" | "created_at" | "updated_at"
      >;
      expectTypeOf<ClientInput>().toExtend<ClientInsert>();
      expectTypeOf<keyof ClientInput>().toEqualTypeOf<keyof ClientInsert>();
    });
  });
});
