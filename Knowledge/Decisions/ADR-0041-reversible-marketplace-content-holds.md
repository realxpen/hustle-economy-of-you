# ADR-0041 — Reversible Marketplace Content Holds

Status: Accepted
Date: 2026-10-08

## Context

Phase 19B grants reversible HUSTLER/AGENT capability suspension. Phase 19C introduces internal transaction casework. The existing Trust & Safety report console permits reviewing and resolving reports, but there is no durable, item-level enforcement control over Posts, Services or Products.

Archiving or pausing an item alone is insufficient: owners and delegated Agents can publish the same content again. Moderation must be a separate authority from account capability, transaction settlement and reputation.

## Decision

Phase 19D introduces **moderationState = CLEAR | HELD** on Post, Service and Product and an append-only MarketplaceModerationAction table for HOLD and RELEASE events.

All moderation operations require AuthGuard + AdminGuard and a non-empty reason. Only admins may apply or release holds.

HOLD:
- atomically sets moderationState=HELD and publication status to ARCHIVED (Post) or PAUSED (Service/Product);
- captures owner, actor, subject, reason, previous/result status in MarketplaceModerationAction;
- emits an audited SystemEvent;
- keeps underlying records and related transaction history intact.

The owner and delegated Agent publication endpoints use conditional, owner-scoped updateMany with moderationState=CLEAR to prevent republishing while held. This check is a database-level write predicate to avoid stale-read bypass. Service/Product deletion endpoints on both owner and Agent paths likewise require CLEAR to preserve the restricted listing while under investigation.

RELEASE:
- atomically changes moderationState back to CLEAR;
- records a reason and event;
- **never auto-publishes**. The content remains ARCHIVED/PAUSED until an eligible owner/Agent explicitly publishes again.

The content moderation action history is append-only in the API; no update/delete mutation endpoint exists for actions.

## Privacy and authorization

- New MarketplaceModerationAction table has RLS enabled.
- Browser Postgres roles anon/authenticated have all direct table privileges revoked.
- Only the server's hustle_api role has SELECT and INSERT permissions and matching RLS policies.
- No external accounts may perform these operations.
- Public discovery still depends on PUBLISHED status. HOLD forces the subject out of public discovery.

## Deliberate non-authorities

A content hold does not:
- suspend a USER, CLIENT, HUSTLER or AGENT capability;
- cancel a Booking or Order;
- confirm payment, issue refund, release escrow or initiate payout;
- modify verified Reviews or reputation;
- automatically mark a SafetyReport as ACTIONED;
- automatically resolve a MarketplaceCase.

Human report review, casework, capability suspension and content removal remain distinct decisions.

## Future expansion

Phase 19D covers Posts, Services and Products. Stories, Live sessions, user messages, profile-level restrictions, user appeals and formal financial enforcement are follow-on policy choices, not implied by this hold.
