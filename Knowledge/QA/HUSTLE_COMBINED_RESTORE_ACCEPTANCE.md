# Combined saved-restore acceptance

Owner request, 2026-10-21: run the remaining engineering tests together without owner terminal work. Prior native login/file, nine-schema and five-SQL milestones are complete; this extends them rather than asking the owner to repeat setup.

## Scope and architecture

One protected manual main-only workflow downloads the already verified encrypted October 20 set. Before private access, its generated job builds the locked API and exercises the new migration/application runner on generated PostgreSQL 17. The private job then runs:

1. A fresh native restore, verified database ownership, nine historical schema comparisons and original row fingerprints. Only in this disposable target, use the repository's installed Prisma CLI to resolve the nine already-present historical migrations and deploy the five pending files. Check all 41 successful migration names/checksums, preservation of the original 28 history rows and unchanged Supabase history. Run deploy again to prove a no-op. This does not authorize production ledger repair.
2. Compare the resulting schema to the independent reference, original non-Prisma table contents, original Storage catalog and new defaults. Clone the migrated database into the existing fixed `hustle_payment_sandbox` test name. Reuse its database-role checks, the existing real Nest application/payment sandbox suite and a new concurrent Booking acceptance/extension test using real Prisma transactions as non-bypass `hustle_api`. No real payment/provider is available.
3. On the original migrated disposable database, recover and rehash all ten files, start the pinned Auth/Storage APIs, sign in/refresh the configured original owner, and recheck owner/other-user/anonymous/public access to backed-up proof files. Login intentionally creates local Auth sessions; original application/Storage contents and Auth/Storage migration/policy definitions must remain unchanged. No additional original account is modified.

All plaintext remains in owned network-disabled containers with RAM-backed writable directories. A digest-pinned Node sibling shares only the database's isolated loopback namespace. Its read-only mounts contain only built public code, dependencies, migrations and test scripts; it receives no Drive credentials, backup passphrase or original account password. It publishes no ports and cannot reach external services. Raw private output is captured and suppressed; failures expose only fixed stage names and public Prisma error codes. Private credentials are removed from the parent environment before any subprocess. Only a fixed aggregate JSON report is uploaded after cleanup.

## Validation and limits

Generated and private results must remain distinct. Passing this run proves this saved dataset's specified migration/tooling, server service/HTTP sandbox flows, concurrent capacity and post-migration Auth/Storage behavior. UI smoke/typechecks/builds remain covered by Foundation CI. It does not test every mobile/device journey, MFA/OAuth, old sessions, every original account, external configuration recovery, real money movement, current live data or full disaster recovery. Production schema/history changes and deployment retain separate gates. The backup was non-atomic and predates any later live writes.

Actual combined run: **NOT RUN** until its report has been independently downloaded and verified. A failure is diagnosed by the agent; no owner terminal handoff.
