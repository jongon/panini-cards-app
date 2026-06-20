import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

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

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const { url, anonKey } = readSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Verify the JWT LOCALLY via asymmetric signing keys (no round-trip to the
  // Supabase Auth server). `getUser()` hits the network on every matched
  // request, which made every navigation wait on that round-trip; `getClaims()`
  // validates the token against the cached JWKS instead. Requires asymmetric
  // JWT signing keys enabled on the Supabase project.
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : (data?.claims ?? null);
  const user =
    claims && typeof claims.sub === "string"
      ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined }
      : null;

  return { response, user, supabase };
}
