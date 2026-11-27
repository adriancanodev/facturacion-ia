"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useId,
  useLayoutEffect,
  useState,
  type SubmitEvent,
} from "react";
import type { QuoteFormValues } from "@/lib/domain/quote-form";
import { computeLiveQuoteTotals } from "@/lib/domain/quote-live-totals";
import type { QuoteFormState } from "@/lib/quotes/types";
import { buildEditorIds } from "./editor-ids";
import { QuoteErrorSummary } from "./quote-error-summary";
import { QuoteHeaderFields, type QuoteClientOption } from "./quote-header-fields";
import { QuoteLines } from "./quote-lines";
import { LiveSummary } from "./quote-live-summary";
import { primaryButtonClassName, secondaryButtonClassName } from "./styles";
import { useQuoteEditor } from "./use-quote-editor";

export type { QuoteClientOption } from "./quote-header-fields";

type QuoteFormAction = (
  prevState: QuoteFormState,
  formData: FormData,
) => Promise<QuoteFormState>;

type QuoteFormProps = {
  action: QuoteFormAction;
  initialState: QuoteFormState;
  clients: readonly QuoteClientOption[];
  submitLabel: string;
  cancelHref: string;
};

export function QuoteForm(props: QuoteFormProps) {
  const [resetCount, setResetCount] = useState(0);

  useLayoutEffect(() => {
    return () => {
      setResetCount((count) => count + 1);
    };
  }, []);

  return <QuoteFormEditor key={resetCount} {...props} />;
}

function QuoteFormEditor({ action, initialState, clients, submitLabel, cancelHref }: QuoteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const { editor, setHeader, setLine, addLine, removeLine } = useQuoteEditor(initialState, state);
  const idPrefix = useId();
  const ids = buildEditorIds(idPrefix);

  const values: QuoteFormValues = { ...editor.header, lines: editor.lines.map((line) => line.values) };
  const live = computeLiveQuoteTotals(values);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={pending || undefined}
      className="flex flex-col gap-6"
    >
      <QuoteErrorSummary
        formError={state.formError}
        fieldErrors={state.fieldErrors}
        lines={editor.lines}
        ids={ids}
      />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Los campos marcados con <span aria-hidden="true">*</span>
        <span className="sr-only">asterisco</span> son obligatorios.
      </p>

      <QuoteHeaderFields
        header={editor.header}
        serverIrpfRate={state.values.irpf_rate}
        clients={clients}
        fieldErrors={state.fieldErrors}
        ids={ids}
        onChange={setHeader}
      />

      <QuoteLines
        lines={editor.lines}
        lineBases={live.lineBases}
        linesErrors={state.fieldErrors.lines}
        ids={ids}
        onChangeLine={setLine}
        onAddLine={addLine}
        onRemoveLine={removeLine}
      />

      <LiveSummary live={live} lineCount={editor.lines.length} />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={secondaryButtonClassName}>
          Cancelar
        </Link>
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
