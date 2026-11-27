import { QUOTE_NOTES_MAX_LENGTH } from "@/lib/domain/quote";
import type { QuoteFieldErrors, QuoteHeaderField } from "@/lib/domain/quote-form";
import { buildIrpfRateOptions } from "@/lib/domain/quote-irpf";
import type { EditorIds } from "./editor-ids";
import { RequiredMark } from "./required-mark";
import { errorTextClassName, inputClassName, labelClassName } from "./styles";
import type { HeaderValues } from "./use-quote-editor";

export type QuoteClientOption = {
  id: string;
  name: string;
  tax_id: string;
};

type QuoteHeaderFieldsProps = {
  header: HeaderValues;
  serverIrpfRate: string;
  clients: readonly QuoteClientOption[];
  fieldErrors: QuoteFieldErrors;
  ids: Pick<EditorIds, "header" | "headerError">;
  onChange: (field: QuoteHeaderField, value: string) => void;
};

export function QuoteHeaderFields({
  header,
  serverIrpfRate,
  clients,
  fieldErrors,
  ids,
  onChange,
}: QuoteHeaderFieldsProps) {
  const irpf = buildIrpfRateOptions(header.irpf_rate);
  const irpfOptions = [
    ...new Set([...buildIrpfRateOptions(serverIrpfRate).options, ...irpf.options]),
  ];

  function fieldProps(field: QuoteHeaderField) {
    const hasError = Boolean(fieldErrors[field]);
    return {
      id: ids.header(field),
      name: field,
      "aria-invalid": hasError ? true : undefined,
      "aria-describedby": hasError ? ids.headerError(field) : undefined,
    };
  }

  function fieldError(field: QuoteHeaderField) {
    const errors = fieldErrors[field];
    if (!errors) return null;
    return (
      <p id={ids.headerError(field)} className={errorTextClassName}>
        {errors.join(" ")}
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor={ids.header("client_id")} className={labelClassName}>
          Cliente <RequiredMark />
        </label>
        <select
          {...fieldProps("client_id")}
          value={header.client_id}
          onChange={(event) => onChange("client_id", event.target.value)}
          aria-required="true"
          className={inputClassName}
        >
          <option value="">Selecciona un cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.tax_id})
            </option>
          ))}
        </select>
        {fieldError("client_id")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.header("issue_date")} className={labelClassName}>
          Fecha de emisión <RequiredMark />
        </label>
        <input
          {...fieldProps("issue_date")}
          type="date"
          value={header.issue_date}
          onChange={(event) => onChange("issue_date", event.target.value)}
          aria-required="true"
          className={inputClassName}
        />
        {fieldError("issue_date")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.header("valid_until")} className={labelClassName}>
          Válido hasta
        </label>
        <input
          {...fieldProps("valid_until")}
          type="date"
          value={header.valid_until}
          min={header.issue_date || undefined}
          onChange={(event) => onChange("valid_until", event.target.value)}
          className={inputClassName}
        />
        {fieldError("valid_until")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.header("irpf_rate")} className={labelClassName}>
          Retención de IRPF
        </label>
        <select
          {...fieldProps("irpf_rate")}
          value={irpf.selected}
          onChange={(event) => onChange("irpf_rate", event.target.value)}
          className={inputClassName}
        >
          {irpfOptions.map((option) => (
            <option key={option} value={option}>
              {option} %
            </option>
          ))}
        </select>
        {fieldError("irpf_rate")}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor={ids.header("notes")} className={labelClassName}>
          Notas
        </label>
        <textarea
          {...fieldProps("notes")}
          rows={3}
          value={header.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          maxLength={QUOTE_NOTES_MAX_LENGTH}
          className={inputClassName}
        />
        {fieldError("notes")}
      </div>
    </div>
  );
}
