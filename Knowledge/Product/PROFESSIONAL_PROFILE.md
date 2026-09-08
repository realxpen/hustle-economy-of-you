# Professional Profile + Digital Identity

## Purpose

Phase 4 turns an approved Hustler capability into a professional identity that can be discovered, understood and trusted.

The profile is not a second account and it is not a role mode.

One Hustle User owns one identity. Professional capability data extends that identity.

## Canonical experience

APPROVED HUSTLER
↓
Professional profile foundation
↓
Add headline, primary skill and supporting skills
↓
Add cover image and professional summary
↓
Publish profile
↓
Visitors can understand who the person is and what they can do
↓
Later phases attach services, products, content, reviews and transactions to the same identity

## Identity ownership

The existing `User` remains the owner of universal identity fields:

- display name
- username
- avatar
- bio
- location
- verified contact state
- capability history

Phase 4 must not duplicate those fields into a second user record.

A dedicated professional profile stores Hustler-specific presentation data such as:

- headline
- cover image
- primary skill
- secondary skills
- professional category
- professional summary
- years of experience
- profile visibility/publish state

## Bootstrap rule

A professional profile can exist only for a User with `HUSTLER ACTIVE`.

When Phase 4 is first activated for an approved Hustler, the system should bootstrap sensible defaults from the approved Hustler application where available:

- primarySkill → primary skill
- category → category
- experienceSummary → professional summary
- yearsExperience → years of experience

The approved application remains historical verification evidence. Editing the professional profile must not rewrite the application or review record.

## Owner experience

The owner can:

- edit professional presentation fields
- add or remove secondary skills
- add/change cover media
- preview the public profile
- publish or unpublish the professional profile

The owner cannot:

- remove CLIENT by editing the profile
- grant or revoke HUSTLER through profile editing
- alter approved verification history

## Visitor experience

A public visitor profile should communicate, at minimum:

- avatar
- cover
- display name
- username
- location
- capability/trust indicator
- headline
- primary skill
- secondary skills
- professional summary
- years of experience

Later phases enrich the same profile with:

- services — Phase 5
- products — Phase 6
- content/posts — Phase 7+
- reviews and outcome trust — Phase 14
- public storefront commerce — Phase 15

Phase 4 must not invent those systems early.

## Public route

MVP profile discovery should use a stable username-based public route. The recommended route is:

`/u/[username]`

The account-owner editing experience remains authenticated and separate from the public visitor view.

## Profile state

The MVP needs a simple publication state:

- DRAFT
- PUBLISHED

Only PUBLISHED professional profiles are publicly resolvable through the visitor route.

An approved Hustler may still keep the professional profile in DRAFT while completing it.

## Phase 4 gate

A real approved Hustler must be able to:

`HUSTLER ACTIVE → bootstrap professional profile → edit professional identity → publish → open /u/[username] as a visitor → see the same identity and professional capability`

The Client capability remains ACTIVE and there is no role switcher.
