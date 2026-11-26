import { ClientForm } from "@/components/clients/client-form";
import { createClientAction } from "@/lib/clients/actions";
import { initialClientFormState } from "@/lib/clients/types";

export default function NewClientPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Nuevo cliente
      </h1>
      <ClientForm
        action={createClientAction}
        initialState={initialClientFormState}
        submitLabel="Crear cliente"
      />
    </div>
  );
}
