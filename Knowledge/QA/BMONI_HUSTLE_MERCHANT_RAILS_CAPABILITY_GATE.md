# Hustle × MONIFlow — BMONI Merchant Rails Capability Gate

Date: 2026-10-13
Status: **SOURCE REVIEW COMPLETED / REAL PROVIDER ACCEPTANCE NOT YET VERIFIED — NO-GO**.
Sources: MONIFlow main at `67a522a65258906fcad110ac6dc4d2704568d0b5`, Hustle main at `f62956ef1e08816f82d6a73c9694e2653bf17164`, and linked BMONI Embedded documentation read October 13, 2026.

## Why this gate exists

Signed MONIFlow `operation.received` is verifiable command intake only. It is **not** a bank-originated collection, payout or refund settlement. Hustle owns Booking/Order status, escrow eligibility, ledger and wallet truth. MONIFlow's personal-wallet and signed command interface is not proof of a licensed merchant acquiring/escrow agreement. No synthetic provider success event can substitute for provider evidence.

## Evidence level definitions

- **Documented by provider**: official BMONI public documentation describes a specific rail or event. No inference that this partner account is eligible.
- **Implemented in MONIFlow**: repository code contains a client call, flow, or test. Does not establish that a live provider accepted it.
- **Provider-tested**: trace/correlation and provider response observed against the BMONI sandbox under an authorized mapped `bmoniUserId`, with no actual production funds. Nothing in this audit itself was exercised against BMONI.
- **Hustle approved**: independent legal, operational and finance review authorizes a tightly scoped merchant use case and exact authority semantics. No use case currently meets this bar.

## Capability matrix — Nigeria / Hustle use cases

| Hustle need | Source-supported BMONI capability | MONIFlow implementation status | Hustle evidence decision |
| --- | --- | --- | --- |
| Partner authentication | Server-side `x-api-key`; sandbox origin `https://embedded-dev.bmoni.com` | BMONI HTTP client and server-only config | Documented/implemented, **no real Hustle partner merchant authorization verified** |
| User-to-BMONI identity | `POST /v1/users`, durable `bmoniUserId` for all user-scoped calls | Create + local mapping | **Blocked**: repository reports repeated 409 existing-persona collision without recoverable user ID; do not brute-force personas |
| Native owned CNGN wallet | Owner-proof EIP-191, managed wallet and device signer | RN path exists; physical/native checkpoint remains pending | Personal wallet feature, **not Hustle escrow** |
| Nigeria KYC and activated NGN rail | KYC → activate → `start-nigeria` → read onboarding status | Calls exist, full same-user live lifecycle not accepted | **Blocked until BMONI sandbox completes identity/KYC/rail** |
| Bank deposit / virtual account | NGN rail docs describe account issuance at `start-nigeria`, bank deposit → CNGN, smart-wallet routing and deposit-account read | Deposit read and `createNgnVirtualAccount` present; routing described in latest runbook, not proven end to end | **No merchant per-Order invoice/virtual-account attribution confirmed** |
| Provider deposit confirmation | Partner-scoped `employee.deposit.completed` / `failed` / `refunded`; HMAC raw-body verification, stable event ID | Dedicated Hustle-MONIFlow signed `operation.received` **is not these provider events** | Documented employee-wallet deposit evidence, **not verified against unique Hustle client, Order, amount, recipient and merchant entitlement** |
| Nigerian bank withdrawal | Bank list → account verification → saved withdrawal account → `offramp/nigeria` → proposal/signing → status | BMONI client methods and MONIFlow execution orchestration; sandbox demo simulations green | Documented personal-wallet offramp; **no authorized Hustle seller payout / bank destination/KYC/settlement validation** |
| Provider withdrawal status | Partner-scoped `employee.withdrawal.processing`, `completed`, `failed`; proposal status | App-side proposal status reads implemented | Provider event/status definition exists; no verified correlation to Hustle Payout and consent chain |
| Merchant-acquiring checkout per Booking/Order | Not established by reviewed Nigeria personal-wallet and employee event pages | MONIFlow partner API only persists simulated RECEIVED commands | **Unverified; do not claim available** |
| Merchant refund initiated by Hustle | `employee.deposit.refunded` is documented as an event when a deposit reverses; this is **not** a documented Hustle-initiated merchant refund command | No approved BMONI refund gateway contract in partner API | **Unverified; no refund operation allowed** |
| Regulated custodial escrow and conditional milestone release | No verified Hustle-compatible escrow/trust account contract in reviewed sources | Hustle's escrow is an internal ledger projection; MONIFlow pockets are bookkeeping | **Legal/custody NO-GO** |
| Business/KYB/payouts | Public business payout/webhook examples inspected concern **Mexico/MXN** business wallets; not proof of Nigerian marketplace merchant/KYB rights | Not a Hustle NGN acquiring adapter | **Nigeria applicability unverified** |

## Provider-source contradictions requiring resolution

1. **NGN virtual account issuance**: Current NGN-specific rails says `start-nigeria` creates the NGN virtual account and `POST /smart-wallets/{smartWalletId}/onramp/vba/nigeria` routes deposits to the CNGN wallet, with `GET /bank-accounts/deposit-accounts/NGN` for readback. The high-level integration flow still lists `POST /vba/ngn`. MONIFlow `BmoniClient.createNgnVirtualAccount` implements `/vba/ngn`, and repo documents themselves disagree on whether to use it. **Do not choose one silently or send a state-changing probe**; ask BMONI for the current NGN contract and account-duplication safety.
2. **Proposal signing representation**: Repo reference says raw `hashToSign` via RN `signTransactionHash`; the current NGN rail page describes an EIP-712 signing payload, while the broader docs describe raw hash signing for some flows. **Do not interchange EIP-191 owner proof, EIP-712 typed data and raw digest signing**. Verify the exact production/sandbox proposal payload, digest and device SDK method with BMONI.
3. **NGN KYC flow order**: Stored runbook says the NGN-only shortcut is BVN lookup → PATCH profile → `start-nigeria` and omits broader KYC activation; official lifecycle/integration docs require a country-appropriate document/readiness/`kyc/activate` stage before rail activation. The repo's `BMONI_INTEGRATION.md` also flags a conflict. **Demand authoritative Nigeria-only sequence** before building further.
4. **Existing user 409 recovery**: Public errors guide advises recovering an already-created user by email rather than retrying `POST /users`, but the reviewed MONIFlow `BmoniUserService` only has a local mapping shortcut, not a verified provider-side lookup/recovery API contract. Request actual existing-user lookup under the same partner scope; don't fabricate an endpoint or create repeated identities.
5. **NGN vs CNGN**: A deposit to an NGN virtual account is credited as CNGN to a personal smart wallet in the documented flow. BMONI product balances/pockets are not automatically user-fiat custodial deposits, payable marketplace escrow, or spendable Hustle balances.

## Authenticated event & evidence acceptance design (not an implemented adapter)

- Confirm approved partner scope and subscriber event names. Official BMONI partner-scoped configuration uses `employee.deposit.*` and `employee.withdrawal.*`, not `wallet.*` (the latter is global/legacy and must not be used to obtain other partners' data).
- Obtain an actual partner-scoped webhook configuration and secret via an authorized BMONI account, with webhook URL, key rotation, transport limits and signing scheme. Never use published example keys, embed secrets, or enable a callback in production without review.
- Verify HMAC SHA-256 over **exact raw body**, constant-time; validate event ID/source ID and tenant, store durable inbox before acknowledgment, reject replay with conflicting terms, inspect BMONI status independently before any terminal financial operation.
- Bind `bmoniUserId`, provider wallet, bank/source reference, invoice/subject/Order/Booking/Payout ID, NGN minor amount, beneficiary KYC/custodian, and final provider state. A generic `employee.deposit.completed` to a personal wallet is insufficient evidence for a specific Hustle Order.
- Preserve UNKNOWN/held funds when provider response is lost, use provider-supported read-only lookup or audit escalation. **Never blind retry money movement** after uncertainty. No sandbox simulation or MONIFlow receipt is equivalent to a provider outcome.
- Require auditable agreements on legal custody, refund liability, settlement accounts, dispute/chargeback handling, merchant of record, money transmitter/PSP roles, fees, reconciliation statements and consent before production.

## Recommended sandbox-first sequence

**B0: Document/provider confirmation (current step)** — Confirm current NGN API/lifecycle/signing contract and merchant use-case eligibility. Save non-secret provider support reply or contract reference; do not send keys/real identities. Request reliable existing-user mapping recovery.

**B1: Isolated real BMONI identity + wallet proof** — Approved sandbox persona, new/recovered `bmoniUserId`, valid native owned wallet, KYC/NGN rail state, funded sandbox balance (approved test credits), deposit account and permitted read-only status. Tests must identify every provider response separately from MONIFlow simulation.

**B2: Real provider evidence intake — read-only** — Only after B0/B1, add a BMONI-specific sandbox webhook verifier with exact provider fields and read-only status correlation, durable deduplication and rejection of tampered/cross-user/unknown callbacks. **No Hustle ledger mutations**.

**B3: Merchant rail proof** — Only if provider explicitly permits this marketplace arrangement, demonstrate one named test Booking/Order collection with identity/amount/order reference, distinct test seller beneficiary, refund semantics and payouts, including offline reconciliation/error states.

**B4: Financial execution pilot — separate authorization** — Independent provider proof and legal/custody contract review, finance security tests, state-machine reconciliation, operator controls and owner permission. No automatic production deployment or live customer funds in previous phases.

## Open provider support questions — written confirmation required

1. Does BMONI support Nigerian **marketplace** merchant collection on behalf of Hustle clients and segregated seller proceeds? Who is licensed custodian/merchant of record?
2. Can one NGN virtual account/deposit or API invoice be reliably attributed to each Hustle Order/Booking and distinct payer and beneficiary? What is the documented reference, settlement ID and API inquiry?
3. Does an NGN merchant refund API exist? How are partial refunds, reversals, disputes and return-to-origin processed, and how are they tied to original collections?
4. Can Hustle pay a **third-party provider/seller** from approved merchant-owned balances without impersonating the provider as personal smart-wallet owner? Required KYC/KYB, authorized signature, bank account ownership?
5. Which event names, payload fields, signing headers/secrets and read-only status endpoints are supported for Nigeria deposit completion, refund/reversal and offramp finality? Do they include immutable transaction ID, amount, currency, payer/beneficiary/wallet attribution, fees and timestamp?
6. Is the current NGN account issued on `start-nigeria` with onramp routing, or created by `POST /vba/ngn`? How to safely avoid duplicate account creation?
7. What is the **current Nigeria-only KYC activation** order and which documents are compulsory?
8. For Nigeria offramp proposal, is mobile signing over raw 32-byte `hashToSign`, EIP-712 typed data, or another method? What exact SDK method corresponds to provider return fields?
9. Can a partner recover a 409 existing sandbox user's `bmoniUserId` by documented scoped lookup, and how is authorization proven? Please give the endpoint/response contract, not an undocumented workaround.
10. Does BMONI permit Hustle's intended escrow/milestone release, wallet custody, settlement and refund flows contractually in Nigeria? If not, what licensed PSP/bank partner is needed?

## Verified references

**MONIFlow repo**
- `docs/BMONI_INTEGRATION.md`, `docs/BMONI_SANDBOX_RUNBOOK.md`, `docs/BMONI_CAPABILITY_MAP.md`, `docs/BMONI_SOURCE_RECONCILIATION.md` (these are not entirely consistent)
- `apps/api/src/services/bmoni/{client.ts,gateway.ts,user-service.ts}`, `apps/api/src/routes/execution.ts`, `PROJECT_STATE.md`
- `docs/HUSTLE_PARTNER_INTEGRATION_V1.md`, `docs/HUSTLE_RECEIPT_PUSH_OUTBOX_SANDBOX.md`

**Official public BMONI (read-only)**
- https://embedded-docs.bmoni.com/api-reference/ngn-rails/
- https://embedded-docs.bmoni.com/api-reference/integration-flow/
- https://embedded-docs.bmoni.com/api-reference/webhooks/
- https://embedded-docs.bmoni.com/api-reference/errors/
- https://embedded-docs.bmoni.com/api-reference/global-payouts/
- https://embedded-docs.bmoni.com/api-reference/sandbox-test-data/
- https://embedded-docs.bmoni.com/lifecycle/

**No BMONI endpoint, identity, KYC, real merchant transaction, payout, refund or webhook subscription was invoked in this review.**
