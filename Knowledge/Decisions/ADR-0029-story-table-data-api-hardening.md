# ADR-0029 — Story Table Data API Hardening

Status: Accepted
Date: 2026-09-17

## Context
Phase 16B introduced Story views, reactions and private replies in Prisma-backed tables inside Supabase's exposed `public` schema. Supabase default table grants made newly created tables accessible to `anon` and `authenticated` unless explicitly revoked, and the security advisor correctly flagged the Story tables because RLS was disabled.

## Decision
`Story`, `StoryView`, `StoryReaction`, and `StoryReply` are server-owned application tables.

- Enable Row Level Security on all four tables.
- Revoke all direct table privileges from `PUBLIC`, `anon`, and `authenticated`.
- Grant `SELECT`, `INSERT`, `UPDATE`, and `DELETE` only to the trusted `hustle_api` database role.
- Add explicit `FOR ALL` RLS policies scoped only to `hustle_api`.
- Browser clients continue to use the Nest API for Story records and interactions.
- Browser-native Story media remains a separate concern in the `story-media` Storage bucket, where upload/delete authority is enforced by Storage RLS.
- The Prisma hardening migration is retry-safe: it explicitly removes and recreates the four `hustle_api` policies so `prisma migrate deploy` can safely recover after an earlier environment already received the desired policies through the Phase 16B activation gate.
- Supabase-owned `storage.objects` policy cleanup is applied through Supabase migration authority rather than Prisma's application database role. The public `story-media` bucket provides public object delivery without granting raw public table-list access.

## Migration recovery note
The hosted Phase 16B activation originally applied the Story RLS policies before Prisma recorded the matching migration. A later Prisma deploy therefore failed with PostgreSQL `42710` because `hustle_api_story_all` already existed. The failed Prisma migration record was marked rolled back after verifying all four Story tables had RLS enabled and only `hustle_api` retained direct application-table privileges. The repository migration was then made deterministic and retry-safe.

This recovery changes migration bookkeeping only; it does not weaken Story security or alter Story data.

## Consequences
A signed-out or signed-in Supabase Data API client cannot directly enumerate, insert, alter, or delete Story application records. Public Story reads remain intentionally available through Hustle's API, which controls expiration, serialization, interaction privacy and conversion-event authority.

This hardening does not change universal User content authority, Story visibility, verified reputation, or the public nature of active Story media URLs.
