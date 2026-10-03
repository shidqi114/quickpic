import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseContext,
  withSupabase,
  type SupabaseContext,
  type WithSupabaseConfig,
} from '@supabase/server';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ||
  '';

const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseServerConfigured = Boolean(
  supabaseUrl && (supabaseSecretKey || supabasePublishableKey)
);

/**
 * Returns a privileged Supabase client using SUPABASE_SECRET_KEY.
 * Used for server-side trusted operations (pairing physical kiosks, ingesting telemetry,
 * running administrative maintenance, bypassing RLS when safe).
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const key = supabaseSecretKey || supabasePublishableKey;
  if (!supabaseUrl || !key) {
    return null;
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Returns a standard server-side Supabase client using publishable/anon key.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  const key = supabasePublishableKey || supabaseSecretKey;
  if (!supabaseUrl || !key) {
    return null;
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates a scoped client forwarding an incoming device token or user bearer token.
 */
export function createScopedClient(bearerToken?: string): SupabaseClient | null {
  const key = supabasePublishableKey || supabaseSecretKey;
  if (!supabaseUrl || !key) {
    return null;
  }

  return createClient(supabaseUrl, key, {
    global: {
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Helper to obtain SupabaseContext from an incoming Request using @supabase/server.
 */
export async function getRequestContext(
  req: Request,
  options?: WithSupabaseConfig
): Promise<
  | { data: SupabaseContext; error: null }
  | { data: null; error: any }
> {
  try {
    return await createSupabaseContext(req, options);
  } catch (err) {
    return { data: null, error: err };
  }
}

// Re-export @supabase/server core functions and types for route handlers
export { createSupabaseContext, withSupabase };
export type { SupabaseContext, WithSupabaseConfig };
