import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function readSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Copy .env.example to .env and fill it in.",
    );
  }
  if (!anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Copy .env.example to .env and fill it in.",
    );
  }

  return { url, anonKey };
}

type CreateSupabaseServerClientOptions = {
  /**
   * When true, session cookies are written with a 30-day maxAge so the user
   * stays signed in across browser restarts. When false (default), cookies
   * are written as session cookies that disappear when the browser closes.
   */
  persistSession?: boolean;
};

export async function getAdminEmail(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  // Verify the JWT LOCALLY via asymmetric signing keys (no round-trip to the
  // Supabase Auth server). The email is carried as a claim, so `getClaims()`
  // avoids the network call `getUser()` would make.
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : (data?.claims ?? null);
  const email = claims && typeof claims.email === "string" ? claims.email : null;
  if (!email) {
    throw new Error("No authenticated admin");
  }
  return email;
}

export async function createSupabaseServerClient(options: CreateSupabaseServerClientOptions = {}) {
  const { persistSession = false } = options;
  const { url, anonKey } = readSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            if (persistSession) {
              cookieStore.set(name, value, {
                ...options,
                maxAge: THIRTY_DAYS_SECONDS,
                expires: new Date(Date.now() + THIRTY_DAYS_SECONDS * 1000),
              });
            } else {
              // Session cookie — cleared when the browser closes.
              cookieStore.set(name, value, {
                ...options,
                maxAge: undefined,
                expires: undefined,
              });
            }
          }
        } catch {
          // Called from a Server Component (read-only cookies).
          // Middleware handles refresh — safe to ignore here.
        }
      },
    },
  });
}
