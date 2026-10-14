# BMONI Developer Support — Hustle/MONIFlow marketplace capability questions

Status: UNSENT TEMPLATE. Obtain written partner documentation and authorization before any real provider operation.
Suggested contact: developers@bkey.me (listed in public BMONI Embedded API docs). Do not email secrets, real customer BVN/NIN, bank account details, access tokens or wallet key material.

**Subject:** Clarification: NGN marketplace collections, refunds, payouts and sandbox user recovery for Hustle × MONIFlow

Hello BMONI Developer Support,

We're evaluating BMONI Embedded for a Nigeria-first skills/services marketplace called Hustle, with MONIFlow as our service-to-service financial orchestration layer. We're currently working **sandbox-first**; no production transactions are enabled.

We have implemented a signed, durable partner-command/receipt proof of concept, but the current MONIFlow receipts are explicitly nonfinancial and do not claim BMONI execution. Before we proceed, could you clarify the following:

1. **Merchant capability / custody:** Does BMONI support collecting client payments on behalf of independent service providers or vendors in Nigeria, with attributable Order/Booking references, settlement, refunds and payouts? Who holds customer funds and what licensing/contractual arrangement would be required for milestone escrow?
2. **Collection attribution:** What official API and webhook fields identify a completed NGN deposit uniquely to an invoice, payer, merchant, destination wallet and exact transaction? Is a virtual account issued per end user only, or can there be per-transaction references/virtual accounts for a marketplace?
3. **Refunds:** Is there an API to request a refund/reversal of a completed NGN collection to the payer, including partial refunds? How do we verify a refund's final outcome?
4. **Payouts:** Can a marketplace initiate authenticated payouts to verified third-party Hustlers from approved funds? Does the Nigerian smart-wallet offramp flow require the beneficiary personally to own and sign the wallet? What provider KYC/KYB and bank verification apply?
5. **Webhook verification:** Are partner-scoped `employee.deposit.*` and `employee.withdrawal.*` events the recommended Nigerian balance/payout lifecycle events? Please confirm official callback payload, HMAC signature, unique correlation IDs, final settlement statuses and polling/fallback endpoints.
6. **NGN account creation conflict:** The current NGN rails page says `start-nigeria` issues the account and `POST .../onramp/vba/nigeria` routes deposits, while the API integration-flow overview also lists `POST .../vba/ngn`. Which is the supported sequence for a new Nigerian account and how do we prevent duplicate issuance?
7. **Nigeria KYC:** Please confirm the currently supported Nigeria-only KYC sequence, including required documents, `readiness`, `kyc/activate` and `start-nigeria`.
8. **Signing method:** Does the Nigerian offramp proposal require EIP-712 typed-data signing or raw `hashToSign` via the React Native SDK's `signTransactionHash`? Please provide a canonical sample response and signer method.
9. **Existing-user 409:** We encountered sandbox identity collisions without a locally saved `bmoniUserId`. Is there a documented partner-scoped, authorized API or support recovery procedure to retrieve the original user ID? We won't retry with new personas or guess an endpoint.

We would appreciate current API reference links, any required merchant entitlement process and an approved sandbox procedure that does not move production money. If marketplace escrow or refunds are not within the supported Nigerian product scope, it would help to know that explicitly so we can use another authorized provider for those rails.

Thank you.

Hustle / MONIFlow Engineering

---

**Internal handling:** This draft is not a claim that BMONI authorizes Hustle merchant acquiring, escrow, custody or bank payouts. Record any provider response in the project knowledge base, assess its specific contract scope, then open a separate sandbox evidence-only implementation PR. Never send keys or real identity data in correspondence.
