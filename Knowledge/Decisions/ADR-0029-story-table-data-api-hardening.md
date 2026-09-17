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

## Consequences
A signed-out or signed-in Supabase Data API client cannot directly enumerate, insert, alter, or delete Story application records. Public Story reads remain intentionally available through Hustle's API, which controls expiration, serialization, interaction privacy and conversion-event authority.

This hardening does not change universal User content authority, Story visibility, verified reputation, or the public nature of active Story media URLs.
