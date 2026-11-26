"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import type { ClientField, ClientFormState } from "@/lib/clients/types";
import {
  CLIENT_ADDRESS_MAX_LENGTH,
  CLIENT_EMAIL_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  CLIENT_PHONE_MAX_LENGTH,
} from "@/lib/domain/client";

const TAX_ID_INPUT_MAX_LENGTH = 20;

type ClientFormAction = (
  prevState: ClientFormState,
  formData: FormData,
) => Promise<ClientFormState>;

type ClientFormProps = {
  action: ClientFormAction;
  initialState: ClientFormState;
  submitLabel: string;
};

const inputClassName =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-500 focus-visible:border-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900 aria-invalid:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:border-zinc-100 dark:focus-visible:outline-zinc-100 dark:aria-invalid:border-red-400";

export function ClientForm({ action, initialState, submitLabel }: ClientFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const idPrefix = useId();

  function fieldProps(field: ClientField) {
    const errors = state.fieldErrors[field];
    const errorId = `${idPrefix}-${field}-error`;
    return {
      id: `${idPrefix}-${field}`,
      name: field,
      defaultValue: state.values[field],
      "aria-invalid": errors ? true : undefined,
      "aria-describedby": errors ? errorId : undefined,
    };
  }

  function fieldError(field: ClientField) {
    const errors = state.fieldErrors[field];
    if (!errors) return null;
    return (
      <p
        id={`${idPrefix}-${field}-error`}
        className="text-sm text-red-700 dark:text-red-300"
      >
        {errors.join(" ")}
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.formError && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {state.formError}
        </p>
      )}

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Los campos marcados con <span aria-hidden="true">*</span>
        <span className="sr-only">asterisco</span> son obligatorios.
      </p>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${idPrefix}-name`}
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Nombre o razón social <RequiredMark />
        </label>
        <input
          {...fieldProps("name")}
          type="text"
          autoComplete="organization"
          aria-required="true"
          maxLength={CLIENT_NAME_MAX_LENGTH}
          className={inputClassName}
        />
        {fieldError("name")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${idPrefix}-tax_id`}
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          NIF/CIF <RequiredMark />
        </label>
        <input
          {...fieldProps("tax_id")}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-required="true"
          maxLength={TAX_ID_INPUT_MAX_LENGTH}
          className={inputClassName}
        />
        {fieldError("tax_id")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${idPrefix}-address`}
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Dirección <RequiredMark />
        </label>
        <textarea
          {...fieldProps("address")}
          rows={2}
          autoComplete="street-address"
          aria-required="true"
          maxLength={CLIENT_ADDRESS_MAX_LENGTH}
          className={inputClassName}
        />
        {fieldError("address")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-email`}
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Email
          </label>
          <input
            {...fieldProps("email")}
            type="email"
            autoComplete="email"
            maxLength={CLIENT_EMAIL_MAX_LENGTH}
            className={inputClassName}
          />
          {fieldError("email")}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-phone`}
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Teléfono
          </label>
          <input
            {...fieldProps("phone")}
            type="tel"
            autoComplete="tel"
            maxLength={CLIENT_PHONE_MAX_LENGTH}
            className={inputClassName}
          />
          {fieldError("phone")}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/clientes"
          className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
        >
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-red-700 dark:text-red-300">
        *
      </span>
      <span className="sr-only">(obligatorio)</span>
    </>
  );
}
