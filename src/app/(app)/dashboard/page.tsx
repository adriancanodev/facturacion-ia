import Link from "next/link";

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Panel
      </h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Aquí aparecerán tus clientes, presupuestos y facturas. Ya puedes{" "}
        <Link
          href="/clientes"
          className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-50 dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-100"
        >
          gestionar tus clientes
        </Link>
        .
      </p>
    </>
  );
}
