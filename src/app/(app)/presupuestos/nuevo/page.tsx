import Link from "next/link";
import { Suspense } from "react";
import { QuoteForm } from "@/components/quotes/quote-form/quote-form";
import { QuoteFormSkeleton } from "@/components/quotes/quote-form-skeleton";
import { requireUser } from "@/lib/auth/session";
import { BUSINESS_TIME_ZONE, isoDateInTimeZone } from "@/lib/domain/date";
import { emptyQuoteFormValues } from "@/lib/domain/quote-form";
import { createQuoteAction } from "@/lib/quotes/actions";
import { initialQuoteFormState, type QuoteFormState } from "@/lib/quotes/types";

const linkClassName =
  "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-50 dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-100";

export default function NewQuotePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Nuevo presupuesto
      </h1>
      <Suspense fallback={<QuoteFormSkeleton label="Cargando el formulario…" />}>
        <NewQuoteEditor />
      </Suspense>
    </div>
  );
}

async function NewQuoteEditor() {
  const { supabase } = await requireUser();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, tax_id")
    .order("name");

  if (error) {
    console.error("NewQuoteEditor: select de clientes falló", { code: error.code });
    return (
      <p
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      >
        No hemos podido cargar tus clientes. Recarga la página en unos segundos.
      </p>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
        <p className="text-zinc-700 dark:text-zinc-300">
          Para crear un presupuesto necesitas al menos un cliente.
        </p>
        <p className="mt-2">
          <Link href="/clientes/nuevo" className={linkClassName}>
            Crear un cliente
          </Link>
        </p>
      </div>
    );
  }

  const initialState: QuoteFormState = {
    ...initialQuoteFormState,
    values: {
      ...emptyQuoteFormValues(),
      issue_date: isoDateInTimeZone(new Date(), BUSINESS_TIME_ZONE),
    },
  };

  return (
    <QuoteForm
      action={createQuoteAction}
      initialState={initialState}
      clients={clients}
      submitLabel="Crear presupuesto"
      cancelHref="/presupuestos"
    />
  );
}
