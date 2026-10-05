# Hustle Web deployment

Production browser authentication and Supabase Storage require these Vercel environment variables on the `web` project:

- `NEXT_PUBLIC_API_URL` — stable Hustle API URL including `/api/v1`
- `NEXT_PUBLIC_SUPABASE_URL` — Hustle Supabase HTTPS project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — active Supabase publishable browser key

`DATABASE_URL` belongs to the API/Prisma project and is not a browser authentication variable.

After any `NEXT_PUBLIC_*` change, rebuild the web project so Next.js bakes the updated value into the production bundle.
