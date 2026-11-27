import { formatCents } from "@/lib/domain/money";
import { QUOTE_LINE_DESCRIPTION_MAX_LENGTH } from "@/lib/domain/quote";
import type { QuoteLineField } from "@/lib/domain/quote-form";
import { VAT_RATES } from "@/lib/domain/quote-totals";
import type { EditorIds } from "./editor-ids";
import { RequiredMark } from "./required-mark";
import {
  errorTextClassName,
  inputClassName,
  labelClassName,
  secondaryButtonClassName,
} from "./styles";
import type { EditorLine } from "./use-quote-editor";

type QuoteLineRowProps = {
  line: EditorLine;
  index: number;
  base: number | null;
  canRemove: boolean;
  ids: Pick<EditorIds, "line" | "lineError">;
  onChange: (field: QuoteLineField, value: string) => void;
  onRemove: () => void;
};

export function QuoteLineRow({
  line,
  index,
  base,
  canRemove,
  ids,
  onChange,
  onRemove,
}: QuoteLineRowProps) {
  const position = index + 1;
  const legendId = `${ids.line(line.key, "description")}-legend`;
  const lineErrorId = ids.lineError(line.key, "line");

  function fieldProps(field: QuoteLineField) {
    const hasError = Boolean(line.errors[field]);
    const describedBy = [
      hasError ? ids.lineError(line.key, field) : null,
      line.errors.line ? lineErrorId : null,
    ].filter((id) => id !== null);
    return {
      id: ids.line(line.key, field),
      name: `lines[${index}][${field}]`,
      value: line.values[field],
      onChange: (event: { target: { value: string } }) => onChange(field, event.target.value),
      "aria-invalid": hasError || line.errors.line ? true : undefined,
      "aria-describedby": describedBy.length > 0 ? describedBy.join(" ") : undefined,
    };
  }

  function fieldError(field: QuoteLineField) {
    const errors = line.errors[field];
    if (!errors) return null;
    return (
      <p id={ids.lineError(line.key, field)} className={errorTextClassName}>
        {errors.join(" ")}
      </p>
    );
  }

  return (
    <li>
      <div
        role="group"
        aria-labelledby={legendId}
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid md:grid-cols-[minmax(0,1fr)_6rem_8rem_6rem_8rem_7rem] md:items-start md:p-3 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <p
          id={legendId}
          className="text-sm font-semibold text-zinc-900 md:sr-only dark:text-zinc-50"
        >
          Línea {position}
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.line(line.key, "description")} className={`${labelClassName} md:sr-only`}>
            Descripción de la línea {position} <RequiredMark />
          </label>
          <input
            {...fieldProps("description")}
            type="text"
            autoComplete="off"
            aria-required="true"
            maxLength={QUOTE_LINE_DESCRIPTION_MAX_LENGTH}
            className={inputClassName}
          />
          {fieldError("description")}
        </div>

        <div className="grid grid-cols-2 gap-3 md:contents">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.line(line.key, "quantity")} className={`${labelClassName} md:sr-only`}>
              Cantidad de la línea {position} <RequiredMark />
            </label>
            <input
              {...fieldProps("quantity")}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-required="true"
              className={`${inputClassName} text-right tabular-nums`}
            />
            {fieldError("quantity")}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.line(line.key, "unit_price")} className={`${labelClassName} md:sr-only`}>
              Precio unitario de la línea {position} (€) <RequiredMark />
            </label>
            <input
              {...fieldProps("unit_price")}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-required="true"
              className={`${inputClassName} text-right tabular-nums`}
            />
            {fieldError("unit_price")}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.line(line.key, "vat_rate")} className={`${labelClassName} md:sr-only`}>
              IVA de la línea {position}
            </label>
            <select {...fieldProps("vat_rate")} className={inputClassName}>
              {!VAT_RATES.some((rate) => String(rate) === line.values.vat_rate) && (
                <option value={line.values.vat_rate}>{line.values.vat_rate || "—"}</option>
              )}
              {VAT_RATES.map((rate) => (
                <option key={rate} value={String(rate)}>
                  {rate} %
                </option>
              ))}
            </select>
            {fieldError("vat_rate")}
          </div>

          <p className="flex flex-col gap-1.5 text-right md:justify-center md:py-2">
            <span className="text-sm font-medium text-zinc-900 md:sr-only dark:text-zinc-100">
              Importe de la línea {position}
            </span>
            <span className="text-base font-medium text-zinc-900 tabular-nums dark:text-zinc-50">
              {base === null ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">sin calcular</span>
                </>
              ) : (
                formatCents(base)
              )}
            </span>
          </p>
        </div>

        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`Quitar la línea ${position}`}
            className={secondaryButtonClassName}
          >
            Quitar
          </button>
        </div>

        {line.errors.line && (
          <p id={lineErrorId} className={`${errorTextClassName} md:col-span-full`}>
            {line.errors.line.join(" ")}
          </p>
        )}
      </div>
    </li>
  );
}
