import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Server-only: never import this in client components
export function createServiceClient() {
  // SUPABASE_INTERNAL_URL is the Docker-network address (http://kong:8000).
  // It is NOT NEXT_PUBLIC so it is never baked into the bundle — always runtime.
  const url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  return createSupabaseClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
