"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireUser, type AuthenticatedContext } from "@/lib/auth/session";
import { toDecimalString } from "@/lib/domain/money";
import { quoteFormDataToInput, quoteInputSchema, type QuoteInput } from "@/lib/domain/quote";
import {
  groupQuoteIssues,
  quoteFormDataToValues,
  type QuoteFieldErrors,
  type QuoteFormValues,
  type ValidationIssue,
} from "@/lib/domain/quote-form";
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  canTransition,
  isDeletable,
  isQuoteStatus,
  type QuoteStatus,
} from "@/lib/domain/quote-status";
import { computeQuoteTotals } from "@/lib/domain/quote-totals";
import type { QuoteActionState, QuoteFormState } from "@/lib/quotes/types";
import type { Database } from "@/types/database";

type ServerSupabase = AuthenticatedContext["supabase"];

const QUOTES_PATH = "/presupuestos";

const RAISE_EXCEPTION_CODE = "P0001";
const FOREIGN_KEY_VIOLATION_CODE = "23503";
const CLIENT_FOREIGN_KEY = "quotes_client_id_user_id_fkey";

const SAVE_QUOTE_ERRORS = {
  notAuthenticated: "not_authenticated",
  linesRequired: "quote_lines_required",
  notEditable: "quote_not_editable",
} as const;
const KNOWN_SAVE_QUOTE_ERRORS: readonly string[] = Object.values(SAVE_QUOTE_ERRORS);

const QUOTE_NOT_FOUND_MESSAGE = "Presupuesto no encontrado.";
const INVALID_CLIENT_MESSAGE = "Selecciona un cliente válido.";
const LINES_REQUIRED_MESSAGE = "Añade entre 1 y 100 líneas.";
const NOT_EDITABLE_MESSAGE =
  "Este presupuesto ya no se puede editar (solo se editan los borradores).";
const NOT_DELETABLE_MESSAGE = "Solo se pueden borrar los presupuestos en borrador.";
const CONCURRENT_CHANGE_MESSAGE =
  "El presupuesto ha cambiado mientras tanto. Recarga la página.";
const INVALID_STATUS_MESSAGE = "Ese cambio de estado no está permitido.";
const GENERIC_SAVE_ERROR =
  "No hemos podido guardar el presupuesto. Inténtalo de nuevo en unos segundos.";
const GENERIC_ACTION_ERROR =
  "No hemos podido completar la operación. Inténtalo de nuevo en unos segundos.";

const quoteIdSchema = z.uuid();
const quoteStatusSchema = z.enum(QUOTE_STATUSES);

type SaveQuoteGeneratedArgs = Database["public"]["Functions"]["save_quote"]["Args"];

type SaveQuoteArgs = {
  p_quote_id: string | null;
  p_client_id: string;
  p_issue_date: string;
  p_valid_until: string | null;
  p_irpf_rate: string;
  p_notes: string | null;
  p_subtotal: string;
  p_vat_total: string;
  p_irpf_total: string;
  p_total: string;
  p_lines: Array<{
    position: number;
    description: string;
    quantity: string;
    unit_price: string;
    vat_rate: number;
    base: string;
  }>;
};

function buildSaveQuoteArgs(quoteId: string | null, input: QuoteInput): SaveQuoteArgs {
  const totals = computeQuoteTotals(input.lines, input.irpf_rate);

  return {
    p_quote_id: quoteId,
    p_client_id: input.client_id,
    p_issue_date: input.issue_date,
    p_valid_until: input.valid_until,
    p_irpf_rate: toDecimalString(input.irpf_rate),
    p_notes: input.notes,
    p_subtotal: toDecimalString(totals.subtotal),
    p_vat_total: toDecimalString(totals.vat_total),
    p_irpf_total: toDecimalString(totals.irpf_total),
    p_total: toDecimalString(totals.total),
    p_lines: totals.lines.map((line, position) => ({
      position,
      description: line.description,
      quantity: toDecimalString(line.quantity_hundredths),
      unit_price: toDecimalString(line.unit_price_cents),
      vat_rate: line.vat_rate,
      base: toDecimalString(line.base),
    })),
  };
}

async function callSaveQuote(supabase: ServerSupabase, args: SaveQuoteArgs) {
  return supabase.rpc("save_quote", args as unknown as SaveQuoteGeneratedArgs);
}

function isSaveQuoteError(error: PostgrestError, message: string): boolean {
  return error.code === RAISE_EXCEPTION_CODE && error.message === message;
}

function formErrorState(message: string, values: QuoteFormValues): QuoteFormState {
  return {
    fieldErrors: {},
    lineErrors: values.lines.map(() => ({})),
    formError: message,
    values,
  };
}

function fieldErrorState(fieldErrors: QuoteFieldErrors, values: QuoteFormValues): QuoteFormState {
  return {
    fieldErrors,
    lineErrors: values.lines.map(() => ({})),
    formError: null,
    values,
  };
}

function validationErrorState(
  issues: readonly ValidationIssue[],
  values: QuoteFormValues,
): QuoteFormState {
  const { fieldErrors, lineErrors, formErrors } = groupQuoteIssues(issues, values.lines.length);
  return { fieldErrors, lineErrors, formError: formErrors[0] ?? null, values };
}

function saveErrorState(
  error: PostgrestError,
  values: QuoteFormValues,
  context: string,
): QuoteFormState {
  if (
    error.code === FOREIGN_KEY_VIOLATION_CODE &&
    error.message.includes(CLIENT_FOREIGN_KEY)
  ) {
    return fieldErrorState({ client_id: [INVALID_CLIENT_MESSAGE] }, values);
  }
  if (isSaveQuoteError(error, SAVE_QUOTE_ERRORS.linesRequired)) {
    return fieldErrorState({ lines: [LINES_REQUIRED_MESSAGE] }, values);
  }
  if (isSaveQuoteError(error, SAVE_QUOTE_ERRORS.notEditable)) {
    return formErrorState(NOT_EDITABLE_MESSAGE, values);
  }

  const isOwnError =
    error.code === RAISE_EXCEPTION_CODE && KNOWN_SAVE_QUOTE_ERRORS.includes(error.message);
  console.error(
    context,
    isOwnError ? { code: error.code, message: error.message } : { code: error.code },
  );
  return formErrorState(GENERIC_SAVE_ERROR, values);
}

async function saveQuote(
  supabase: ServerSupabase,
  quoteId: string | null,
  formData: FormData,
  context: string,
): Promise<{ ok: true; id: string } | { ok: false; state: QuoteFormState }> {
  const rawInput = quoteFormDataToInput(formData);
  const values = quoteFormDataToValues(rawInput);

  const parsed = quoteInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, state: validationErrorState(parsed.error.issues, values) };
  }

  const { data, error } = await callSaveQuote(supabase, buildSaveQuoteArgs(quoteId, parsed.data));
  if (error) {
    if (isSaveQuoteError(error, SAVE_QUOTE_ERRORS.notAuthenticated)) {
      redirect("/");
    }
    return { ok: false, state: saveErrorState(error, values, context) };
  }

  return { ok: true, id: data };
}

export async function createQuoteAction(
  _prevState: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const { supabase } = await requireUser();

  const result = await saveQuote(supabase, null, formData, "createQuoteAction: save_quote falló");
  if (!result.ok) return result.state;

  revalidatePath(QUOTES_PATH, "layout");
  redirect(`${QUOTES_PATH}/${result.id}`);
}

export async function updateQuoteAction(
  quoteId: unknown,
  _prevState: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const { supabase } = await requireUser();

  const id = quoteIdSchema.safeParse(quoteId);
  if (!id.success) {
    return formErrorState(
      QUOTE_NOT_FOUND_MESSAGE,
      quoteFormDataToValues(quoteFormDataToInput(formData)),
    );
  }

  const result = await saveQuote(supabase, id.data, formData, "updateQuoteAction: save_quote falló");
  if (!result.ok) return result.state;

  revalidatePath(QUOTES_PATH, "layout");
  redirect(`${QUOTES_PATH}/${result.id}`);
}

type CurrentStatusResult = { ok: true; status: QuoteStatus } | { ok: false; error: string };

async function readCurrentStatus(
  supabase: ServerSupabase,
  quoteId: string,
  context: string,
): Promise<CurrentStatusResult> {
  const { data, error } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    console.error(context, { code: error.code });
    return { ok: false, error: GENERIC_ACTION_ERROR };
  }
  if (!data) return { ok: false, error: QUOTE_NOT_FOUND_MESSAGE };
  if (!isQuoteStatus(data.status)) {
    console.error(context, { code: "unknown_status" });
    return { ok: false, error: GENERIC_ACTION_ERROR };
  }
  return { ok: true, status: data.status };
}

function actionError(error: string): QuoteActionState {
  return { error };
}

export async function changeQuoteStatusAction(
  quoteId: unknown,
  to: unknown,
  _prevState: QuoteActionState,
  _formData: FormData,
): Promise<QuoteActionState> {
  const { supabase } = await requireUser();

  const id = quoteIdSchema.safeParse(quoteId);
  if (!id.success) return actionError(QUOTE_NOT_FOUND_MESSAGE);
  const target = quoteStatusSchema.safeParse(to);
  if (!target.success) return actionError(INVALID_STATUS_MESSAGE);

  const context = "changeQuoteStatusAction";
  const current = await readCurrentStatus(supabase, id.data, `${context}: lectura falló`);
  if (!current.ok) return actionError(current.error);

  if (!canTransition(current.status, target.data)) {
    return actionError(
      `No se puede pasar de «${QUOTE_STATUS_LABELS[current.status]}» a «${QUOTE_STATUS_LABELS[target.data]}».`,
    );
  }

  const { data, error } = await supabase
    .from("quotes")
    .update({ status: target.data })
    .eq("id", id.data)
    .eq("status", current.status)
    .select("id");
  if (error) {
    console.error(`${context}: update falló`, { code: error.code });
    return actionError(GENERIC_ACTION_ERROR);
  }
  if (data.length === 0) return actionError(CONCURRENT_CHANGE_MESSAGE);

  revalidatePath(QUOTES_PATH, "layout");
  return { error: null };
}

export async function deleteQuoteAction(
  quoteId: unknown,
  _prevState: QuoteActionState,
  _formData: FormData,
): Promise<QuoteActionState> {
  const { supabase } = await requireUser();

  const id = quoteIdSchema.safeParse(quoteId);
  if (!id.success) return actionError(QUOTE_NOT_FOUND_MESSAGE);

  const context = "deleteQuoteAction";
  const current = await readCurrentStatus(supabase, id.data, `${context}: lectura falló`);
  if (!current.ok) return actionError(current.error);
  if (!isDeletable(current.status)) return actionError(NOT_DELETABLE_MESSAGE);

  const { data, error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", id.data)
    .eq("status", "draft")
    .select("id");
  if (error) {
    console.error(`${context}: delete falló`, { code: error.code });
    return actionError(GENERIC_ACTION_ERROR);
  }
  if (data.length === 0) return actionError(CONCURRENT_CHANGE_MESSAGE);

  revalidatePath(QUOTES_PATH, "layout");
  redirect(QUOTES_PATH);
}
