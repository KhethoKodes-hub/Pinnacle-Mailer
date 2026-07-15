# Demo Runbook

## Goal

Show strict-authenticated mail management across templates, layouts, and media.

## Why This Assessment Matters

This work was assessed as a business-risk and operational-readiness initiative, not merely a header/footer editor.

Problems addressed:

- reduce campaign defects from ad-hoc template updates,
- preserve brand consistency across a growing template surface,
- provide safe rollback and accountability for production changes,
- enforce secure auth boundaries for both users and machine clients,
- establish a demo-to-production baseline that can scale into sending workflows.

## How We Tackled Delivery

We executed in phased increments, validating build and runtime behavior after each milestone:

1. Foundation and trust boundaries (BFF + authenticated admin shell).
2. Session and auth hardening (refresh lifecycle, lockout controls, endpoint throttling).
3. Core management workflows (templates, layouts, media, preview, metadata updates).
4. Demo readiness and repeatability (seeded credentials, one-command reset, operator runbook).

## Setup

1. Install dependencies:

   npm install

2. Generate Prisma client:

   npm run db:generate

3. Apply local migrations (if needed):

   npm run db:migrate

4. Seed demo data and credentials:

   npm run db:seed

5. Start backend and frontend in separate terminals:

   npm run dev:backend
   npm run dev:frontend

## Fast Reset For Demo Day

Use this command to rebuild demo data and regenerate one-time client secrets:

   npm run db:demo-reset

Warning: this resets the local database and removes existing local data.

## Seeded Credentials

The seed command prints one-time demo credentials:

- Users:
   ADMIN_EMAIL / ADMIN_PASSWORD defaults to `admin@pinnacle.local` / `admin1234`.
   DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD defaults to `demo@byom.de` / `demo1234`.
- API clients:
  - pinnacle-admin-bff
  - partner-readonly

Client secrets are generated fresh on every seed run and printed once.

## Demo Script

1. Open frontend login page.
2. Sign in with demo or admin user.
3. Templates:
   - Create template
   - Edit template
   - Publish template
   - Rollback template
   - Preview template
4. Layouts:
   - Create layout
   - Edit layout (name/type/mjml)
   - Confirm usage impact counts update
5. Media:
   - Upload image
   - Edit alt text and caption

## Optional Auth Checks

1. Trigger lockout by entering wrong password repeatedly.
2. Confirm lockout message shows retry timing.
3. Sign in successfully once lockout expires.

## Notes

- Strict auth is always enforced through session + BFF.
- Outbound email sending is intentionally out of scope for this demo baseline.
- The demonstrated value includes governance, traceability, and operational safety beyond visual content management.
