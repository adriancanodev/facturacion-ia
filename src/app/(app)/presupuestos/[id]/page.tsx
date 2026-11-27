import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { QuoteActions, type StatusTransition } from "@/components/quotes/quote-actions";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatIsoDate } from "@/lib/domain/date";
import { formatCents } from "@/lib/domain/money";
import { hundredthsToCompactText, numericToHundredths } from "@/lib/domain/quote-form";
import { isDeletable, nextStatuses, parseQuoteStatus } from "@/lib/domain/quote-status";
import { buildQuoteSummary, type QuoteSummary } from "@/lib/domain/quote-summary";
import { changeQuoteStatusAction, deleteQuoteAction } from "@/lib/quotes/actions";
import type { Tables } from "@/types/database";

const quoteIdSchema = z.uuid();

type QuoteLineRow = Pick<
  Tables<"quote_lines">,
  "id" | "description" | "quantity" | "unit_price" | "vat_rate" | "base"
>;

const linkClassName =
  "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-50 dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-100";

export default function QuoteDetailPage({ params }: PageProps<"/presupuestos/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/presupuestos" className={linkClassName}>
          Volver a presupuestos
        </Link>
      </p>
      <Suspense fallback={<QuoteDetailSkeleton />}>
        <QuoteDetail params={params} />
      </Suspense>
    </div>
  );
}

async function QuoteDetail({ params }: { params: PageProps<"/presupuestos/[id]">["params"] }) {
  const { supabase } = await requireUser();
  const { id } = await params;

  const quoteId = quoteIdSchema.safeParse(id);
  if (!quoteId.success) notFound();

  const [quoteResult, linesResult] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, number, status, issue_date, valid_until, notes, irpf_rate, subtotal, vat_total, irpf_total, total, clients(name, tax_id)",
      )
      .eq("id", quoteId.data)
      .maybeSingle(),
    supabase
      .from("quote_lines")
      .select("id, description, quantity, unit_price, vat_rate, base")
      .eq("quote_id", quoteId.data)
      .order("position"),
  ]);

  if (quoteResult.error || linesResult.error) {
    console.error("QuoteDetail: select falló", {
      code: quoteResult.error?.code ?? linesResult.error?.code,
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

  const lines = linesResult.data;
  const summary = buildQuoteSummary(quote, lines);
  const status = parseQuoteStatus(quote.status);

  const transitions: StatusTransition[] = nextStatuses(status).map((to) => ({
    to,
    action: changeQuoteStatusAction.bind(null, quote.id, to),
  }));
  const deleteAction = isDeletable(status) ? deleteQuoteAction.bind(null, quote.id) : null;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Presupuesto {quote.number}
          </h1>
          <QuoteStatusBadge status={status} />
        </div>

        <dl className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-0.5">
            <dt className="text-zinc-600 dark:text-zinc-400">Cliente</dt>
            <dd className="break-words font-medium text-zinc-900 dark:text-zinc-50">
              {quote.clients?.name ?? "—"}
            </dd>
            {quote.clients?.tax_id && (
              <dd className="text-zinc-700 dark:text-zinc-300">
                <span className="sr-only">NIF/CIF: </span>
                {quote.clients.tax_id}
              </dd>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-zinc-600 dark:text-zinc-400">Fecha de emisión</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{formatIsoDate(quote.issue_date)}</dd>
          </div>
          {quote.valid_until && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-zinc-600 dark:text-zinc-400">Válido hasta</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {formatIsoDate(quote.valid_until)}
              </dd>
            </div>
          )}
          {quote.notes && (
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-zinc-600 dark:text-zinc-400">Notas</dt>
              <dd className="break-words whitespace-pre-line text-zinc-900 dark:text-zinc-50">
                {quote.notes}
              </dd>
            </div>
          )}
        </dl>
      </header>

      <QuoteActions
        key={status}
        quoteNumber={quote.number}
        transitions={transitions}
        deleteAction={deleteAction}
      />

      <QuoteLines lines={lines} />

      <QuoteSummaryList summary={summary} />
    </article>
  );
}

function QuoteLines({ lines }: { lines: readonly QuoteLineRow[] }) {
  const rows = lines.map((line) => ({
    id: line.id,
    description: line.description,
    quantity: hundredthsToCompactText(numericToHundredths(line.quantity)),
    unitPrice: formatCents(numericToHundredths(line.unit_price)),
    vatRate: `${line.vat_rate} %`,
    base: formatCents(numericToHundredths(line.base)),
  }));

  return (
    <section aria-labelledby="quote-lines-heading" className="flex flex-col gap-3">
      <h2
        id="quote-lines-heading"
        className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
      >
        Líneas
      </h2>

      {rows.length === 0 ? (
        <p className="text-zinc-700 dark:text-zinc-300">Este presupuesto no tiene líneas.</p>
      ) : (
        <>
          {/* Móvil: tarjetas apiladas, legibles desde 360 px. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((line) => (
              <li
                key={line.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="break-words whitespace-pre-line text-zinc-900 dark:text-zinc-50">
                  {line.description}
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-700 dark:text-zinc-300">
                  <dt>Cantidad</dt>
                  <dd className="text-right tabular-nums">{line.quantity}</dd>
                  <dt>Precio unitario</dt>
                  <dd className="text-right tabular-nums">{line.unitPrice}</dd>
                  <dt>IVA</dt>
                  <dd className="text-right tabular-nums">{line.vatRate}</dd>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-50">Importe</dt>
                  <dd className="text-right font-medium text-zinc-900 tabular-nums dark:text-zinc-50">
                    {line.base}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla. */}
          <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Líneas del presupuesto</caption>
              <thead className="border-b border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Descripción
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Cantidad
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Precio unitario
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    IVA
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Importe
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-900 dark:divide-zinc-800 dark:text-zinc-100">
                {rows.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 break-words whitespace-pre-line">
                      {line.description}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {line.quantity}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {line.unitPrice}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {line.vatRate}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {line.base}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function QuoteSummaryList({ summary }: { summary: QuoteSummary }) {
  return (
    <section aria-labelledby="quote-summary-heading" className="flex flex-col gap-3 md:items-end">
      <h2
        id="quote-summary-heading"
        className="text-lg font-semibold text-zinc-900 md:sr-only dark:text-zinc-50"
      >
        Resumen
      </h2>
      <dl className="grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700 md:max-w-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <SummaryRow label="Base imponible" value={formatCents(summary.subtotal)} />

        {summary.vatBreakdown ? (
          summary.vatBreakdown.map((entry) => (
            <SummaryRow
              key={entry.vat_rate}
              label={`IVA ${entry.vat_rate} % (sobre ${formatCents(entry.base)})`}
              value={formatCents(entry.vat)}
            />
          ))
        ) : (
          <SummaryRow label="IVA" value={formatCents(summary.vatTotal)} />
        )}

        {summary.irpfRateHundredths > 0 && (
          <SummaryRow
            label={`IRPF ${hundredthsToCompactText(summary.irpfRateHundredths)} %`}
            value={`-${formatCents(summary.irpfTotal)}`}
          />
        )}

        <dt className="border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
          Total
        </dt>
        <dd className="border-t border-zinc-200 pt-2 text-right text-base font-semibold text-zinc-900 tabular-nums dark:border-zinc-800 dark:text-zinc-50">
          {formatCents(summary.total)}
        </dd>
      </dl>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  );
}

function QuoteDetailSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Cargando el presupuesto…</span>
      <div
        aria-hidden="true"
        className="h-8 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
      />
      <div
        aria-hidden="true"
        className="h-32 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
      />
      <div
        aria-hidden="true"
        className="h-48 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
      />
    </div>
  );
}
