import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import {
  CLIENT_SEARCH_MAX_LENGTH,
  buildClientSearchFilter,
  readClientSearchQuery,
} from "@/lib/domain/client-search";
import type { Tables } from "@/types/database";

type ClientsSearchParams = PageProps<"/clientes">["searchParams"];

type ClientListItem = Pick<
  Tables<"clients">,
  "id" | "name" | "tax_id" | "email" | "phone"
>;

const linkClassName =
  "font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-50 dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-100";

export default function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Clientes
        </h1>
        <Link
          href="/clientes/nuevo"
          className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
        >
          Nuevo cliente
        </Link>
      </div>

      <Suspense fallback={<SearchForm query="" />}>
        <SearchFormWithQuery searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ClientListSkeleton />}>
        <ClientList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchFormWithQuery({
  searchParams,
}: {
  searchParams: ClientsSearchParams;
}) {
  const query = readClientSearchQuery((await searchParams).q);
  return <SearchForm query={query} />;
}

function SearchForm({ query }: { query: string }) {
  return (
    <Form action="/clientes" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor="client-search" className="sr-only">
        Buscar clientes por nombre, NIF/CIF o email
      </label>
      <input
        key={query}
        id="client-search"
        name="q"
        type="search"
        defaultValue={query}
        maxLength={CLIENT_SEARCH_MAX_LENGTH}
        placeholder="Nombre, NIF/CIF o email"
        autoComplete="off"
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-500 focus-visible:border-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900 sm:max-w-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:border-zinc-100 dark:focus-visible:outline-zinc-100"
      />
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
      >
        Buscar
      </button>
    </Form>
  );
}

async function ClientList({
  searchParams,
}: {
  searchParams: ClientsSearchParams;
}) {
  const { supabase } = await requireUser();
  const query = readClientSearchQuery((await searchParams).q);
  const filter = buildClientSearchFilter(query);

  let request = supabase
    .from("clients")
    .select("id, name, tax_id, email, phone")
    .order("name");
  if (filter) {
    request = request.or(filter);
  }

  const { data: clients, error } = await request;

  if (error) {
    console.error("ClientList: select falló", { code: error.code });
    return (
      <p
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      >
        No hemos podido cargar tus clientes. Recarga la página en unos segundos.
      </p>
    );
  }

  if (clients.length === 0) {
    return query === "" ? <NoClients /> : <NoMatches query={query} />;
  }

  return (
    <>
      {/* Móvil: tarjetas apiladas, legibles desde 360 px. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {clients.map((client) => (
          <li
            key={client.id}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="font-medium break-words text-zinc-900 dark:text-zinc-50">
              {client.name}
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {client.tax_id}
            </p>
            {client.email && (
              <p className="text-sm break-all text-zinc-700 dark:text-zinc-300">
                {client.email}
              </p>
            )}
            {client.phone && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {client.phone}
              </p>
            )}
            <p className="mt-2">
              <EditClientLink client={client} />
            </p>
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla. */}
      <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Listado de clientes</caption>
          <thead className="border-b border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Nombre
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                NIF/CIF
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Teléfono
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-zinc-900 dark:divide-zinc-800 dark:text-zinc-100">
            {clients.map((client) => (
              <tr key={client.id}>
                <th scope="row" className="px-4 py-3 font-medium">
                  {client.name}
                </th>
                <td className="px-4 py-3 whitespace-nowrap">{client.tax_id}</td>
                <td className="px-4 py-3 break-all">{client.email ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {client.phone ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <EditClientLink client={client} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EditClientLink({ client }: { client: ClientListItem }) {
  return (
    <Link href={`/clientes/${client.id}/editar`} className={linkClassName}>
      Editar<span className="sr-only"> {client.name}</span>
    </Link>
  );
}

function NoClients() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
      <p className="text-zinc-700 dark:text-zinc-300">Aún no tienes clientes.</p>
      <p className="mt-2">
        <Link href="/clientes/nuevo" className={linkClassName}>
          Crea tu primer cliente
        </Link>
      </p>
    </div>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
      <p className="break-words text-zinc-700 dark:text-zinc-300">
        No hay clientes que coincidan con «{query}».
      </p>
      <p className="mt-2">
        <Link href="/clientes" className={linkClassName}>
          Limpiar la búsqueda
        </Link>
      </p>
    </div>
  );
}

function ClientListSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Cargando tus clientes…</span>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          aria-hidden="true"
          className="h-16 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
        />
      ))}
    </div>
  );
}
