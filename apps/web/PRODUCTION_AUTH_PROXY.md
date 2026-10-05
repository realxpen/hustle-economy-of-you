# Production Supabase browser gateway

Production browser authentication and Supabase Storage use the same-origin `/_supabase/*` gateway on the Hustle web deployment. Next.js rewrites that path server-side to the configured `NEXT_PUBLIC_SUPABASE_URL`.

This avoids making mobile browsers depend on direct access to the `*.supabase.co` hostname while keeping the publishable key client-safe. No service-role key or database credential is exposed to the browser.
