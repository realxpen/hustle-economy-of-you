# ADR-0028 — Stories Experience

Status: Accepted
Date: 2026-09-17

## Context
Phase 16A established server-owned 24-hour Stories and universal User-level content authority. Phase 16B adds the interaction and distribution experience without creating a second identity, commerce, trust or reputation system.

## Decision
Story viewing, reactions and replies are interaction layers around the canonical `Story` record.

### Views
A Story view is a unique browser/session view, deduplicated by `Story + viewerKey`. The browser generates a random opaque viewer key. It is analytics only, not identity, trust or reputation evidence.

### Reactions
Authenticated Users may keep at most one current reaction per Story. MVP reactions are `HEART`, `FIRE`, `CLAP`, and `HUNDRED`. A User cannot react to their own Story. Reaction counts are social signals only.

### Replies
Replies are private Story responses. They are readable by the Story owner and by the User who authored the reply, not by the public. Reply creation uses Hustle's existing block policy so blocked users cannot contact one another through Stories. Story replies are not public comments and do not affect reputation.

### Sequential viewing
The web viewer resolves the current active Story against the same active Story collection and provides previous/next navigation. Video completion may advance to the next active Story.

### Native media
Authenticated Users may upload Story images/videos to the dedicated public `story-media` Supabase Storage bucket. Object paths begin with the authenticated Supabase user ID and `/stories/`. The API stores `mediaStorageKey`, verifies identity-path ownership, and derives the public URL from `SUPABASE_URL` where configured.

MVP limits:
- JPEG, PNG, WebP, GIF images: max 10 MB
- MP4, WebM, QuickTime video: max 50 MB

The bucket is public because active Stories are public. Insert/delete authority remains owner-scoped by Storage RLS.

### Conversion observation
Story → profile, Service and Product clicks emit controlled SystemEvents with server-derived targets. These are product observation events only.

## Invariants
- Every authenticated Hustle User can create Stories; HUSTLER is not required.
- Story views, reactions and replies never grant capabilities or change verified public reputation.
- Service/Product references continue to resolve canonical published offers and do not transfer ownership.
- Private trust/safety information never appears in the public Story read model.
- Block policy applies to private Story replies.
