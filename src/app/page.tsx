import { StartDemoButton } from "@/components/auth/start-demo-button";

const FEATURES = [
  "Clientes",
  "Presupuestos con IVA e IRPF",
  "Facturas con numeración correlativa",
  "PDF de presupuestos y facturas",
  "Panel con el resumen de tu negocio",
  "Presupuestos generados con IA",
];

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 sm:px-8 dark:bg-zinc-950">
      <section className="flex w-full max-w-2xl flex-col gap-8 rounded-2xl bg-white p-6 shadow-sm sm:p-10 dark:bg-zinc-900">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Facturación IA
          </h1>
          <p className="text-lg leading-7 text-zinc-700 dark:text-zinc-300">
            Un mini-ERP de facturación para autónomos y pymes.
          </p>
        </header>

        <ul className="grid gap-2 text-zinc-700 sm:grid-cols-2 dark:text-zinc-300">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span aria-hidden="true" className="text-zinc-400">
                •
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <StartDemoButton />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Se crea una cuenta temporal con datos ficticios que se borra al
            salir o en 24 h.
          </p>
        </div>
      </section>
    </main>
  );
}
