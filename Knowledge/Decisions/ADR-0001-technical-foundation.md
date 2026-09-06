# ADR-0001 — Phase 1 Technical Foundation

Decision: Start Hustle as a TypeScript monorepo with React Native + Expo mobile, Next.js web/admin, a NestJS modular-monolith API, PostgreSQL + Prisma, Redis boundary, object-storage boundary, and Vercel web previews.

Why: The approved architecture calls for mobile-first clients, web/admin clients, modular backend domains, PostgreSQL, Redis, object storage and progressive scale while explicitly warning against premature distributed complexity.

Status: Active
Date: 2026-09-06
Affected Systems: Repository, mobile, web, admin, API, data, CI/CD, preview infrastructure.
Supersedes: None.
Consequences: Domain boundaries are preserved in code, but they remain inside one backend deployment until evidence justifies extracting services.
