import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ClientForm } from "@/components/clients/client-form";
import { updateClientAction } from "@/lib/clients/actions";
import { clientFormStateFromRow } from "@/lib/clients/types";
import { requireUser } from "@/lib/auth/session";

const clientIdSchema = z.uuid();

export default function EditClientPage({
  params,
}: PageProps<"/clientes/[id]/editar">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Editar cliente
      </h1>
      <Suspense fallback={<ClientFormSkeleton />}>
        <EditClientForm params={params} />
      </Suspense>
    </div>
  );
}

async function EditClientForm({
  params,
}: {
  params: PageProps<"/clientes/[id]/editar">["params"];
}) {
  const { supabase } = await requireUser();
  const { id } = await params;

  const clientId = clientIdSchema.safeParse(id);
  if (!clientId.success) notFound();

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, tax_id, address, email, phone")
    .eq("id", clientId.data)
    .maybeSingle();

  if (error) {
    console.error("EditClientForm: select falló", { code: error.code });
    return (
      <p
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      >
        No hemos podido cargar el cliente. Recarga la página en unos segundos.
      </p>
    );
  }

  if (!client) notFound();

  return (
    <ClientForm
      action={updateClientAction.bind(null, client.id)}
      initialState={clientFormStateFromRow(client)}
      submitLabel="Guardar cambios"
    />
  );
}

function ClientFormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">Cargando el cliente…</span>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} aria-hidden="true" className="flex flex-col gap-1.5">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
