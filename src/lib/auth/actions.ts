"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/session";
import type { DemoActionState } from "@/lib/auth/types";
import { createServerSupabase } from "@/lib/supabase/server";

const RATE_LIMIT_MESSAGE =
  "Se han creado demasiadas demos desde tu conexión. Prueba de nuevo en unos minutos.";
const GENERIC_START_ERROR =
  "No hemos podido crear la demo. Inténtalo de nuevo en unos segundos.";

function isRateLimitError(error: AuthError): boolean {
  return error.status === 429 || error.code === "over_request_rate_limit";
}

export async function startDemo(
  _prevState: DemoActionState,
  _formData: FormData,
): Promise<DemoActionState> {
  const supabase = await createServerSupabase();

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
    redirect("/dashboard");
  }

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    if (isRateLimitError(signInError)) {
      return { error: RATE_LIMIT_MESSAGE };
    }
    console.error("startDemo: signInAnonymously falló", {
      status: signInError.status,
      code: signInError.code,
    });
    return { error: GENERIC_START_ERROR };
  }

  const { error: seedError } = await supabase.rpc("seed_demo_data");
  if (seedError) {
    console.error("startDemo: seed_demo_data falló", { code: seedError.code });
    await supabase.rpc("delete_my_demo_account");
    await supabase.auth.signOut({ scope: "local" });
    return { error: GENERIC_START_ERROR };
  }

  redirect("/dashboard");
}

export async function endDemo(): Promise<void> {
  const { supabase } = await requireUser();

  const { error: deleteError } = await supabase.rpc("delete_my_demo_account");
  if (deleteError) {
    console.error("endDemo: delete_my_demo_account falló", {
      code: deleteError.code,
    });
  }

  await supabase.auth.signOut({ scope: "local" });

  redirect("/");
}
