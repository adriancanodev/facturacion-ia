"use client";

import { useActionState, type SubmitEvent } from "react";
import type { QuoteStatus } from "@/lib/domain/quote-status";
import { initialQuoteActionState, type QuoteActionState } from "@/lib/quotes/types";

type QuoteAction = (prevState: QuoteActionState, formData: FormData) => Promise<QuoteActionState>;

export type StatusTransition = {
  to: QuoteStatus;
  action: QuoteAction;
};

type QuoteActionsProps = {
  quoteNumber: string;
  transitions: readonly StatusTransition[];
  deleteAction: QuoteAction | null;
};

const TRANSITION_LABELS: Record<QuoteStatus, string> = {
  draft: "Volver a borrador",
  sent: "Marcar como enviado",
  accepted: "Marcar como aceptado",
  rejected: "Marcar como rechazado",
};

const primaryButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100";

const dangerButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full border border-red-300 px-5 text-sm font-medium text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950 dark:focus-visible:outline-red-300";

export function QuoteActions({ quoteNumber, transitions, deleteAction }: QuoteActionsProps) {
  if (transitions.length === 0 && deleteAction === null) return null;

  return (
    <section
      aria-label="Acciones del presupuesto"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start"
    >
      {transitions.map((transition) => (
        <ActionForm
          key={transition.to}
          action={transition.action}
          label={TRANSITION_LABELS[transition.to]}
          pendingLabel="Guardando…"
          className={primaryButtonClassName}
        />
      ))}
      {deleteAction && (
        <ActionForm
          action={deleteAction}
          label="Borrar"
          pendingLabel="Borrando…"
          className={dangerButtonClassName}
          confirmMessage={`¿Seguro que quieres borrar el presupuesto ${quoteNumber}? Esta acción no se puede deshacer.`}
        />
      )}
    </section>
  );
}

type ActionFormProps = {
  action: QuoteAction;
  label: string;
  pendingLabel: string;
  className: string;
  confirmMessage?: string;
};

function ActionForm({ action, label, pendingLabel, className, confirmMessage }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialQuoteActionState);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-2">
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 sm:max-w-xs dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
