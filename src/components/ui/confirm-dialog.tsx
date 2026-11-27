"use client";

import { useEffect, useId, useRef, type MouseEvent, type SyntheticEvent } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  /** Server Action (o la `formAction` de `useActionState`) que se ejecuta al confirmar. */
  formAction: (formData: FormData) => void;
  /** Se llama cuando el modal ya se ha cerrado sin confirmar (Cancelar, Escape o fondo). */
  onClose: () => void;
  confirmButtonClassName: string;
};

const cancelButtonClassName =
  "inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100";

/**
 * Modal de confirmación sobre el `<dialog>` nativo con `showModal()`: el navegador
 * ya atrapa el foco, deja el fondo inerte y cierra con Escape, sin dependencias.
 * Contiene el propio `<form action>`, así el botón de confirmar es un submit normal
 * y no hace falta enlazarlo con el atributo `form=` a un formulario de fuera.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  formAction,
  onClose,
  confirmButtonClassName,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Foco inicial en la opción segura.
      cancelButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Todas las vías de cierre pasan por dialog.close(): así el evento `close` es la
  // única fuente de verdad y el padre recibe el aviso con el modal ya cerrado
  // (cuando el resto de la página deja de ser inerte y puede recibir el foco).
  function requestClose() {
    if (pending) return;
    dialogRef.current?.close();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Escape: mientras se borra no se permite cerrar.
    if (pending) event.preventDefault();
  }

  function handleClose() {
    const dialog = dialogRef.current;
    if (pending && dialog) {
      dialog.showModal();
      return;
    }
    onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) requestClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleBackdropClick}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        )}
        <form
          action={formAction}
          className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
        >
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={requestClose}
            disabled={pending}
            className={cancelButtonClassName}
          >
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={confirmButtonClassName}>
            {pending ? pendingLabel : confirmLabel}
          </button>
        </form>
      </div>
    </dialog>
  );
}
