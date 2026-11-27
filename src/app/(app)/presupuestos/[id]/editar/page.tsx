import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { QuoteForm } from "@/components/quotes/quote-form/quote-form";
import { QuoteFormSkeleton } from "@/components/quotes/quote-form-skeleton";
import { requireUser } from "@/lib/auth/session";
import { isEditable, parseQuoteStatus } from "@/lib/domain/quote-status";
import { updateQuoteAction } from "@/lib/quotes/actions";
import { quoteFormStateFromRows } from "@/lib/quotes/types";

const quoteIdSchema = z.uuid();

const linkClassName =
  "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-50 dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-100";

export default function EditQuotePage({ params }: PageProps<"/presupuestos/[id]/editar">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Editar presupuesto
      </h1>
      <Suspense fallback={<QuoteFormSkeleton label="Cargando el presupuesto…" />}>
        <EditQuoteEditor params={params} />
      </Suspense>
    </div>
  );
}

async function EditQuoteEditor({
  params,
}: {
  params: PageProps<"/presupuestos/[id]/editar">["params"];
}) {
  const { supabase } = await requireUser();
  const { id } = await params;

  const quoteId = quoteIdSchema.safeParse(id);
  if (!quoteId.success) notFound();

  const [quoteResult, linesResult, clientsResult] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, number, status, client_id, issue_date, valid_until, irpf_rate, notes, updated_at")
      .eq("id", quoteId.data)
      .maybeSingle(),
    supabase
      .from("quote_lines")
      .select("position, description, quantity, unit_price, vat_rate")
      .eq("quote_id", quoteId.data)
      .order("position"),
    supabase.from("clients").select("id, name, tax_id").order("name"),
  ]);

  if (quoteResult.error || linesResult.error || clientsResult.error) {
    console.error("EditQuoteEditor: select falló", {
      code: quoteResult.error?.code ?? linesResult.error?.code ?? clientsResult.error?.code,
    });
    return (
      <p
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      >
        No hemos podido cargar el presupuesto. Recarga la página en unos segundos.
      </p>
    );
  }

  const quote = quoteResult.data;
  if (!quote) notFound();

  const detailHref = `/presupuestos/${quote.id}`;

  if (!isEditable(parseQuoteStatus(quote.status))) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
        <p className="text-zinc-700 dark:text-zinc-300">
          Solo se pueden editar presupuestos en borrador. El presupuesto {quote.number} ya no
          está en borrador.
        </p>
        <p>
          <Link href={detailHref} className={linkClassName}>
            Ver el presupuesto {quote.number}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-zinc-700 dark:text-zinc-300">Presupuesto {quote.number}</p>
      <QuoteForm
        key={`${quote.id}:${quote.updated_at}`}
        action={updateQuoteAction.bind(null, quote.id)}
        initialState={quoteFormStateFromRows(quote, linesResult.data)}
        clients={clientsResult.data}
        submitLabel="Guardar cambios"
        cancelHref={detailHref}
      />
    </div>
  );
}
