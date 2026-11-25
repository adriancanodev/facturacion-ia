import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  isAuthApiError,
  isAuthSessionMissingError,
  type AuthError,
} from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATH = "/";
const PRIVATE_HOME_PATH = "/dashboard";

type SessionCookie = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  const sessionCookies = new Map<string, SessionCookie>();
  const sessionHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach((cookie) => {
            request.cookies.set(cookie.name, cookie.value);
            sessionCookies.set(cookie.name, cookie);
          });
          Object.assign(sessionHeaders, headers);
        },
      },
    }
  );

  const continueResponse = () =>
    withSession(NextResponse.next({ request }), sessionCookies, sessionHeaders);

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    return withSession(NextResponse.redirect(url), sessionCookies, sessionHeaders);
  };

  const { data } = await supabase.auth.getClaims();

  if (!isPageNavigation(request)) {
    return continueResponse();
  }

  const isPublicPath = request.nextUrl.pathname === PUBLIC_PATH;

  if (!data?.claims) {
    return isPublicPath ? continueResponse() : redirectTo(PUBLIC_PATH);
  }

  if (!isPublicPath) {
    return continueResponse();
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user) {
    return redirectTo(PRIVATE_HOME_PATH);
  }

  if (error && isSessionRejected(error)) {
    await supabase.auth.signOut({ scope: "local" });
  }

  return continueResponse();
}

function isPageNavigation(request: NextRequest): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

function isSessionRejected(error: AuthError): boolean {
  if (isAuthSessionMissingError(error)) {
    return true;
  }
  return isAuthApiError(error) && error.status >= 400 && error.status < 500;
}

function withSession(
  response: NextResponse,
  cookies: Map<string, SessionCookie>,
  headers: Record<string, string>
): NextResponse {
  cookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  Object.entries(headers).forEach(([key, value]) =>
    response.headers.set(key, value)
  );
  return response;
}
