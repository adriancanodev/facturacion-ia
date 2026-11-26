"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import {
  emptyClientFormValues,
  type ClientFormState,
  type ClientFormValues,
} from "@/lib/clients/types";
import { clientInputSchema } from "@/lib/domain/client";

const UNIQUE_VIOLATION_CODE = "23505";

const DUPLICATE_TAX_ID_MESSAGE = "Ya tienes un cliente con este NIF/CIF.";
const CLIENT_NOT_FOUND_MESSAGE = "Cliente no encontrado.";
const GENERIC_SAVE_ERROR =
  "No hemos podido guardar el cliente. Inténtalo de nuevo en unos segundos.";

const CLIENT_FIELDS = clientInputSchema.keyof().options;

const clientIdSchema = z.uuid();

function readClientFormValues(formData: FormData): ClientFormValues {
  const values = { ...emptyClientFormValues };
  for (const field of CLIENT_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === "string" ? raw : "";
  }
  return values;
}

function formErrorState(
  message: string,
  values: ClientFormValues,
): ClientFormState {
  return { fieldErrors: {}, formError: message, values };
}

function databaseErrorState(
  error: PostgrestError,
  values: ClientFormValues,
  context: string,
): ClientFormState {
  if (error.code === UNIQUE_VIOLATION_CODE) {
    return {
      fieldErrors: { tax_id: [DUPLICATE_TAX_ID_MESSAGE] },
      formError: null,
      values,
    };
  }
  console.error(context, { code: error.code });
  return formErrorState(GENERIC_SAVE_ERROR, values);
}

function revalidateClientPages(): void {
  revalidatePath("/clientes", "layout");
}

export async function createClientAction(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const { supabase } = await requireUser();

  const values = readClientFormValues(formData);
  const parsed = clientInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: null,
      values,
    };
  }

  const { error } = await supabase.from("clients").insert(parsed.data);
  if (error) {
    return databaseErrorState(error, values, "createClientAction: insert falló");
  }

  revalidateClientPages();
  redirect("/clientes");
}

export async function updateClientAction(
  clientId: unknown,
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const { supabase } = await requireUser();

  const values = readClientFormValues(formData);
  const id = clientIdSchema.safeParse(clientId);
  if (!id.success) {
    return formErrorState(CLIENT_NOT_FOUND_MESSAGE, values);
  }

  const parsed = clientInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      formError: null,
      values,
    };
  }

  const { data, error } = await supabase
    .from("clients")
    .update(parsed.data)
    .eq("id", id.data)
    .select("id");
  if (error) {
    return databaseErrorState(error, values, "updateClientAction: update falló");
  }
  if (data.length === 0) {
    return formErrorState(CLIENT_NOT_FOUND_MESSAGE, values);
  }

  revalidateClientPages();
  redirect("/clientes");
}
