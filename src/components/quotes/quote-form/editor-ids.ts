import type { QuoteHeaderField, QuoteLineField } from "@/lib/domain/quote-form";

export type EditorIds = {
  header: (field: QuoteHeaderField) => string;
  headerError: (field: QuoteHeaderField) => string;
  line: (key: string, field: QuoteLineField) => string;
  lineError: (key: string, field: QuoteLineField | "line") => string;
  lines: string;
  linesError: string;
  addLine: string;
};

export function buildEditorIds(idPrefix: string): EditorIds {
  return {
    header: (field) => `${idPrefix}-${field}`,
    headerError: (field) => `${idPrefix}-${field}-error`,
    line: (key, field) => `${idPrefix}-${key}-${field}`,
    lineError: (key, field) => `${idPrefix}-${key}-${field}-error`,
    lines: `${idPrefix}-lines`,
    linesError: `${idPrefix}-lines-error`,
    addLine: `${idPrefix}-add-line`,
  };
}
