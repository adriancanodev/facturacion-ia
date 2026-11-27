import { useEffect, useRef } from "react";
import { QUOTE_LINES_MAX } from "@/lib/domain/quote";
import type { QuoteLineField } from "@/lib/domain/quote-form";
import type { EditorIds } from "./editor-ids";
import { QuoteLineRow } from "./quote-line-row";
import { errorTextClassName, secondaryButtonClassName } from "./styles";
import type { EditorLine } from "./use-quote-editor";

type QuoteLinesProps = {
  lines: readonly EditorLine[];
  lineBases: readonly (number | null)[];
  linesErrors: readonly string[] | undefined;
  ids: EditorIds;
  onChangeLine: (key: string, field: QuoteLineField, value: string) => void;
  onAddLine: () => string;
  onRemoveLine: (key: string) => void;
};

export function QuoteLines({
  lines,
  lineBases,
  linesErrors,
  ids,
  onChangeLine,
  onAddLine,
  onRemoveLine,
}: QuoteLinesProps) {
  const pendingFocusId = useRef<string | null>(null);

  useEffect(() => {
    if (pendingFocusId.current === null) return;
    document.getElementById(pendingFocusId.current)?.focus();
    pendingFocusId.current = null;
  });

  function addLine() {
    pendingFocusId.current = ids.line(onAddLine(), "description");
  }

  function removeLine(key: string) {
    pendingFocusId.current = ids.addLine;
    onRemoveLine(key);
  }

  const canAddLine = lines.length < QUOTE_LINES_MAX;
  const canRemoveLine = lines.length > 1;

  return (
    <section
      aria-labelledby={`${ids.lines}-heading`}
      aria-describedby={linesErrors ? ids.linesError : undefined}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${ids.lines}-heading`} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Líneas
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {lines.length} de {QUOTE_LINES_MAX}
        </p>
      </div>

      {linesErrors && (
        <p id={ids.linesError} className={errorTextClassName}>
          {linesErrors.join(" ")}
        </p>
      )}

      {/* Cabecera de columnas solo visual en escritorio; cada campo tiene su label. */}
      <div
        aria-hidden="true"
        className="hidden gap-3 px-3 text-sm font-medium text-zinc-600 md:grid md:grid-cols-[minmax(0,1fr)_6rem_8rem_6rem_8rem_7rem] dark:text-zinc-400"
      >
        <span>Descripción</span>
        <span>Cantidad</span>
        <span>Precio unitario</span>
        <span>IVA</span>
        <span className="text-right">Importe</span>
        <span />
      </div>

      <ol id={ids.lines} className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <QuoteLineRow
            key={line.key}
            line={line}
            index={index}
            base={lineBases[index] ?? null}
            canRemove={canRemoveLine}
            ids={ids}
            onChange={(field, value) => onChangeLine(line.key, field, value)}
            onRemove={() => removeLine(line.key)}
          />
        ))}
      </ol>

      <div className="flex flex-col gap-1">
        <button
          id={ids.addLine}
          type="button"
          onClick={addLine}
          disabled={!canAddLine}
          className={`${secondaryButtonClassName} self-start`}
        >
          Añadir línea
        </button>
        {!canAddLine && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Has llegado al máximo de {QUOTE_LINES_MAX} líneas.
          </p>
        )}
      </div>
    </section>
  );
}
