import type { ClientInput } from "@/lib/domain/client";

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
