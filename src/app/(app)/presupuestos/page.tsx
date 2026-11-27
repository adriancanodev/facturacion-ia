import Link from "next/link";
import { Suspense } from "react";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatIsoDate } from "@/lib/domain/date";
import { formatCents } from "@/lib/domain/money";
import { numericToHundredths } from "@/lib/domain/quote-form";
import { parseQuoteStatus } from "@/lib/domain/quote-status";

const linkClassName =
  "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-50 dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-100";

export default function QuotesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Presupuestos
        </h1>
        <Link
          href="/presupuestos/nuevo"
          className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
        >
          Nuevo presupuesto
        </Link>
      </div>

      <Suspense fallback={<QuoteListSkeleton />}>
        <QuoteList />
      </Suspense>
    </div>
  );
}

async function QuoteList() {
  const { supabase } = await requireUser();

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, number, issue_date, status, total, clients(name)")
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false });

  if (error) {
    console.error("QuoteList: select falló", { code: error.code });
    return (
      <p
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      >
        No hemos podido cargar tus presupuestos. Recarga la página en unos segundos.
      </p>
    );
  }

  if (quotes.length === 0) return <NoQuotes />;

  const rows = quotes.map((quote) => ({
    id: quote.id,
    number: quote.number,
    clientName: quote.clients?.name ?? "—",
    issueDate: formatIsoDate(quote.issue_date),
    status: parseQuoteStatus(quote.status),
    total: formatCents(numericToHundredths(quote.total)),
  }));

  return (
    <>
      {/* Móvil: tarjetas apiladas, legibles desde 360 px. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((quote) => (
          <li
            key={quote.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/presupuestos/${quote.id}`} className={linkClassName}>
                {quote.number}
              </Link>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <p className="break-words text-zinc-900 dark:text-zinc-50">{quote.clientName}</p>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                <span className="sr-only">Fecha de emisión: </span>
                {quote.issueDate}
              </p>
              <p className="font-medium text-zinc-900 tabular-nums dark:text-zinc-50">
                <span className="sr-only">Total: </span>
                {quote.total}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla. */}
      <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Listado de presupuestos, del más reciente al más antiguo</caption>
          <thead className="border-b border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Número
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Cliente
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Fecha de emisión
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-zinc-900 dark:divide-zinc-800 dark:text-zinc-100">
            {rows.map((quote) => (
              <tr key={quote.id}>
                <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link href={`/presupuestos/${quote.id}`} className={linkClassName}>
                    {quote.number}
                  </Link>
                </th>
                <td className="px-4 py-3 break-words">{quote.clientName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{quote.issueDate}</td>
                <td className="px-4 py-3">
                  <QuoteStatusBadge status={quote.status} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                  {quote.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function NoQuotes() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
      <p className="text-zinc-700 dark:text-zinc-300">Aún no tienes presupuestos.</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Cuando crees uno, aparecerá aquí con su número, cliente, estado y total.
      </p>
    </div>
  );
}

function QuoteListSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Cargando tus presupuestos…</span>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          aria-hidden="true"
          className="h-16 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
        />
      ))}
    </div>
  );
}
