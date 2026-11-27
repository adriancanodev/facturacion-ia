import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NavLink } from "@/components/app/nav-link";
import { EndDemoButton } from "@/components/auth/end-demo-button";
import { endDemo } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

const NAV_ITEMS = [
  { href: "/dashboard", segment: "dashboard", label: "Panel" },
  { href: "/clientes", segment: "clientes", label: "Clientes" },
  { href: "/presupuestos", segment: "presupuestos", label: "Presupuestos" },
] as const;

const navLinkClassName =
  "inline-flex h-11 items-center border-b-2 px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100";
const navLinkActiveClassName =
  "border-amber-500 text-zinc-900 dark:text-zinc-50";
const navLinkInactiveClassName =
  "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <p
        role="status"
        className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        Modo demo: tus datos son ficticios y se borran al salir o en 24 h
      </p>

      <Suspense fallback={<ProfileHeaderSkeleton />}>
        <ProfileHeader />
      </Suspense>

      <nav
        aria-label="Secciones"
        className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      >
        <ul className="mx-auto flex w-full max-w-5xl gap-6 px-4 sm:px-8">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Suspense
                fallback={
                  <Link
                    href={item.href}
                    className={`${navLinkClassName} ${navLinkInactiveClassName}`}
                  >
                    {item.label}
                  </Link>
                }
              >
                <NavLink
                  href={item.href}
                  segment={item.segment}
                  className={navLinkClassName}
                  activeClassName={navLinkActiveClassName}
                  inactiveClassName={navLinkInactiveClassName}
                >
                  {item.label}
                </NavLink>
              </Suspense>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}

async function ProfileHeader() {
  const { supabase } = await requireUser();

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("name")
    .maybeSingle();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <p className="min-w-0 truncate text-lg font-medium text-zinc-900 dark:text-zinc-50">
          {profile?.name ?? "Tu empresa"}
        </p>
        <form action={endDemo}>
          <EndDemoButton />
        </form>
      </div>
    </header>
  );
}

function ProfileHeaderSkeleton() {
  return (
    <header
      aria-busy="true"
      className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <span className="sr-only">Cargando tu perfil…</span>
        <div
          aria-hidden="true"
          className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
        />
        <div
          aria-hidden="true"
          className="h-10 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800"
        />
      </div>
    </header>
  );
}
