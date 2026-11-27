import {
  QUOTE_HEADER_FIELDS,
  QUOTE_LINE_FIELDS,
  type QuoteFieldErrors,
} from "@/lib/domain/quote-form";
import type { EditorIds } from "./editor-ids";
import { HEADER_FIELD_LABELS, LINE_FIELD_LABELS } from "./styles";
import type { EditorLine } from "./use-quote-editor";

type ErrorSummaryItem = {
  key: string;
  message: string;
  targetId: string;
};

type ErrorSummaryIds = Pick<EditorIds, "header" | "line" | "lines">;

function buildErrorSummary(
  fieldErrors: QuoteFieldErrors,
  lines: readonly EditorLine[],
  ids: ErrorSummaryIds,
): ErrorSummaryItem[] {
  const items: ErrorSummaryItem[] = [];

  for (const field of QUOTE_HEADER_FIELDS) {
    for (const [i, message] of (fieldErrors[field] ?? []).entries()) {
      items.push({
        key: `${field}-${i}`,
        message: `${HEADER_FIELD_LABELS[field]}: ${message}`,
        targetId: ids.header(field),
      });
    }
  }

  for (const [i, message] of (fieldErrors.lines ?? []).entries()) {
    items.push({ key: `lines-${i}`, message: `Líneas: ${message}`, targetId: ids.lines });
  }

  lines.forEach((line, index) => {
    const position = index + 1;
    for (const field of QUOTE_LINE_FIELDS) {
      for (const [i, message] of (line.errors[field] ?? []).entries()) {
        items.push({
          key: `${line.key}-${field}-${i}`,
          message: `Línea ${position}, ${LINE_FIELD_LABELS[field].toLowerCase()}: ${message}`,
          targetId: ids.line(line.key, field),
        });
      }
    }
    for (const [i, message] of (line.errors.line ?? []).entries()) {
      items.push({
        key: `${line.key}-line-${i}`,
        message: `Línea ${position}: ${message}`,
        targetId: ids.line(line.key, "description"),
      });
    }
  });

  return items;
}

type QuoteErrorSummaryProps = {
  formError: string | null;
  fieldErrors: QuoteFieldErrors;
  lines: readonly EditorLine[];
  ids: ErrorSummaryIds;
};

export function QuoteErrorSummary({ formError, fieldErrors, lines, ids }: QuoteErrorSummaryProps) {
  const errorSummary = buildErrorSummary(fieldErrors, lines, ids);
  if (!formError && errorSummary.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <p className="font-medium">{formError ?? "No se ha podido guardar. Revisa estos datos:"}</p>
      {errorSummary.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {errorSummary.map((item) => (
            <li key={item.key}>
              <a
                href={`#${item.targetId}`}
                className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:focus-visible:outline-red-300"
              >
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
