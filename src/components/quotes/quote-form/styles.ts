import type { QuoteHeaderField, QuoteLineField } from "@/lib/domain/quote-form";

export const inputClassName =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-500 focus-visible:border-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900 aria-invalid:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:border-zinc-100 dark:focus-visible:outline-zinc-100 dark:aria-invalid:border-red-400";

export const labelClassName = "text-sm font-medium text-zinc-900 dark:text-zinc-100";

export const errorTextClassName = "text-sm text-red-700 dark:text-red-300";

export const secondaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100";

export const primaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100";

export const HEADER_FIELD_LABELS: Record<QuoteHeaderField, string> = {
  client_id: "Cliente",
  issue_date: "Fecha de emisión",
  valid_until: "Válido hasta",
  irpf_rate: "IRPF",
  notes: "Notas",
};

export const LINE_FIELD_LABELS: Record<QuoteLineField, string> = {
  description: "Descripción",
  quantity: "Cantidad",
  unit_price: "Precio unitario",
  vat_rate: "IVA",
};
