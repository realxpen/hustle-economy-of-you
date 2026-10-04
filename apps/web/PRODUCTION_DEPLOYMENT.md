# Hustle Web Production Deployment

The production web app must use the stable Hustle API alias with the canonical API prefix:

`NEXT_PUBLIC_API_URL=https://api-two-ashy-21.vercel.app/api/v1`

This file intentionally lives inside `apps/web` so production environment changes trigger an affected-project rebuild of the web application in the monorepo.
