# UX050 — Isolated payment-preview API release repair (2026-11-01)

## Observed release evidence

- Test-only credential preflight passed on [GitHub run 41232432341](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41232432341).
- First dedicated API stack creation failed because Lambda could not read the dedicated ECR image. AWS ECR repository policy was then restricted to `lambda.amazonaws.com` retrieving this single function's image.
- The subsequent [run 41289665658](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41289665658) created the separate stack and Lambda, then passed actual HTTPS health (200), anonymous payment read denial (401), and GET webhook denial (403). It stopped at Cloudflare publication: Wrangler 4.45 rejects `--workers-dev` as an unknown CLI argument.
- [Run 41308675609](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41308675609) reached CloudFormation but failed during update preflight because the GitHub OIDC deploy role lacked `cloudformation:GetTemplateSummary`. This did not roll back the earlier successfully created stack.
- Read-only AWS state confirmed stack `hustle-payment-preview-api` is `CREATE_COMPLETE`, Lambda is `Active`, and the ECR image exists. The deploy role's existing `DedicatedPreviewStackOnly` statement was amended only to include `cloudformation:GetTemplateSummary`, restricted to `arn:aws:cloudformation:eu-west-2:707859598737:stack/hustle-payment-preview-api/*`, and then independently read back.

## Code fix proposed in this PR

1. Use a dedicated `infra/cloudflare/payment-preview-api.wrangler.jsonc` with `workers_dev: true`, explicit isolated Worker name, entrypoint and compatibility date.
2. Make the protected manual release workflow point at this config and keep injecting only `PREVIEW_UPSTREAM_ORIGIN` from the dedicated Lambda URL.
3. Add CI assertions that reject the unsupported `--workers-dev` CLI argument and refuse drift in the dedicated Worker configuration.

## Release and safety boundary

This PR **does not deploy** the Worker, Lambda, or app; does not authorize live payment use, change GitHub environment secrets, affect production or staging, or remove the manual approval / restricted OIDC controls.

After CI is green and the PR is reviewed/merged, a **fresh manual** run of `hustle-payment-preview-api-deploy.yml` on `main` with the previously approved independent Neon identifiers is required to verify Cloudflare publication and the hosted endpoint. The existing backend health evidence must not be represented as a successful Cloudflare or end-to-end payment-preview acceptance.
