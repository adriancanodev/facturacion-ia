"use client";

import { useActionState } from "react";
import { startDemo } from "@/lib/auth/actions";
import type { DemoActionState } from "@/lib/auth/types";

const initialState: DemoActionState = { error: null };

export function StartDemoButton() {
  const [state, formAction, pending] = useActionState(startDemo, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-3 sm:w-auto">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
      >
        {pending ? "Creando tu demo…" : "Probar la demo"}
      </button>
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
