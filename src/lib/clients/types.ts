import type { ClientInput } from "@/lib/domain/client";
import type { Tables } from "@/types/database";

export type ClientField = keyof ClientInput;

export type ClientFormValues = Record<ClientField, string>;

export type ClientFormState = {
  fieldErrors: Partial<Record<ClientField, string[]>>;
  formError: string | null;
  values: ClientFormValues;
};

export const emptyClientFormValues: ClientFormValues = {
  name: "",
  tax_id: "",
  address: "",
  email: "",
  phone: "",
};

export const initialClientFormState: ClientFormState = {
  fieldErrors: {},
  formError: null,
  values: emptyClientFormValues,
};

export type EditableClientRow = Pick<Tables<"clients">, ClientField>;

export function clientFormStateFromRow(row: EditableClientRow): ClientFormState {
  return {
    fieldErrors: {},
    formError: null,
    values: {
      name: row.name,
      tax_id: row.tax_id,
      address: row.address,
      email: row.email ?? "",
      phone: row.phone ?? "",
    },
  };
}
