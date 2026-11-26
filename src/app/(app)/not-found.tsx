import Link from "next/link";

export default function AppNotFound() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        No lo hemos encontrado
      </h1>
      <p className="text-zinc-700 dark:text-zinc-300">
        Lo que buscas no existe o ya no está disponible.
      </p>
      <p>
        <Link
          href="/clientes"
          className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-50 dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-100"
        >
          Volver a clientes
        </Link>
      </p>
    </section>
  );
}
