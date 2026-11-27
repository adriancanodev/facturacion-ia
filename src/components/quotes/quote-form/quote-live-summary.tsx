import { useId } from "react";
import { formatCents } from "@/lib/domain/money";
import { hundredthsToCompactText } from "@/lib/domain/quote-form";
import type { LiveQuoteTotals } from "@/lib/domain/quote-live-totals";

type LiveSummaryProps = {
  live: LiveQuoteTotals;
  lineCount: number;
};

export function LiveSummary({ live, lineCount }: LiveSummaryProps) {
  const headingId = useId();
  const ignoredCount = lineCount - live.includedLineCount;
  const irpfRate = live.irpfRateHundredths ?? 0;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 md:items-end">
      <h2 id={headingId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Resumen
      </h2>

      <div
        aria-live="polite"
        className="flex w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700 md:max-w-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      >
        {live.summary ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
            <SummaryRow label="Base imponible" value={formatCents(live.summary.subtotal)} />
            {live.summary.vat_breakdown.map((entry) => (
              <SummaryRow
                key={entry.vat_rate}
                label={`IVA ${entry.vat_rate} % (sobre ${formatCents(entry.base)})`}
                value={formatCents(entry.vat)}
              />
            ))}
            {irpfRate > 0 && (
              <SummaryRow
                label={`IRPF ${hundredthsToCompactText(irpfRate)} %`}
                value={`-${formatCents(live.summary.irpf_total)}`}
              />
            )}
            <dt className="border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
              Total
            </dt>
            <dd className="border-t border-zinc-200 pt-2 text-right text-base font-semibold text-zinc-900 tabular-nums dark:border-zinc-800 dark:text-zinc-50">
              {formatCents(live.summary.total)}
            </dd>
          </dl>
        ) : (
          <p>
            {live.totalTooLarge
              ? "El total del presupuesto es demasiado grande."
              : "Completa la cantidad y el precio de alguna línea para ver los totales."}
          </p>
        )}

        {live.summary && ignoredCount > 0 && (
          <p className="text-zinc-600 dark:text-zinc-400">
            {ignoredCount === 1
              ? "Hay 1 línea incompleta o con datos no válidos que no se suma."
              : `Hay ${ignoredCount} líneas incompletas o con datos no válidos que no se suman.`}
          </p>
        )}
      </div>

      <p className="text-sm text-zinc-600 md:max-w-sm md:text-right dark:text-zinc-400">
        Vista previa: el total definitivo lo calcula el servidor al guardar.
      </p>
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
