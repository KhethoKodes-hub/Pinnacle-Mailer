# Security Overview

## Trust Boundaries

- Next.js is the browser-facing BFF for admin workflows.
- NestJS is the protected system-of-record API and external integration surface.
- Browser clients should not hold privileged backend secrets.

## Machine-to-Machine Authentication

- External systems obtain an access token from `POST /api/auth/token` using `clientId` and `clientSecret`.
- Access tokens are short-lived signed JWTs.
- Client secrets are stored hashed only.
- Scopes constrain each client to only the API capabilities it needs.

## Auth Endpoint Throttling

- Global baseline throttling remains enabled for all API routes.
- Auth endpoints apply stricter per-route limits:
- `POST /api/auth/login`: 10 requests/minute
- `POST /api/auth/token`: 30 requests/minute
- `POST /api/auth/refresh`: 60 requests/minute
- `POST /api/auth/logout`: 30 requests/minute

## Example Seeded Clients

Development seed currently provisions:

- `pinnacle-admin-bff`
- `partner-readonly`

The seed script generates fresh plaintext client secrets on each run, stores only hashed values, and prints the plaintext values once for local testing.

## Example Seeded Users

Development seed provisions:

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults: `admin@pinnacle.local` / `admin1234`)
- `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` (defaults: `demo@byom.de` / `demo1234`)

Both user sets are environment-configurable for demo preparation.

## User Authentication

- User login currently issues a signed admin token for bootstrap purposes.
- The Next.js admin layer now uses Auth.js for session management with HTTP-only session cookies.
- The browser never stores backend bearer tokens directly.
- Repeated failed login attempts trigger temporary account lockout (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_SECONDS`).

## Refresh Token Lifecycle

- Backend now issues an access-token and refresh-token pair for admin login.
- Refresh tokens are persisted as hashed values only and rotated on each refresh call.
- Logout revokes the active refresh token family and requires re-authentication.
- If refresh token replay or invalid refresh state is detected, session refresh is denied.

## Next.js BFF Session Boundary

- Admin browser requests are authenticated via Auth.js session state.
- Next.js BFF route handlers forward requests to backend modules using the logged-in user's bearer token.
- Auth.js server callbacks refresh backend access tokens transparently using refresh tokens.
- Backend authorization remains scope-enforced by the NestJS access token guard.
- BFF forwards `x-request-id` to preserve request correlation in backend logs and audit records.

## Required Frontend Runtime Configuration

- `BACKEND_API_BASE_URL` must point to the NestJS API origin.
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`) is required for Auth.js session signing.
- `AUTH_URL` (or `NEXTAUTH_URL`) should match the public frontend URL.

## Observability

- Request logging uses structured logs with request IDs.
- Audit logs remain the source of truth for business mutations.

## API Documentation

- Swagger is exposed at `/api/docs`.
- Protected endpoints require a bearer token.

## Risk Reduction Mapping

The controls implemented during this assessment were selected to reduce specific operational and security risks:

- BFF session boundary + server-side token forwarding:
  reduces browser-side exposure of privileged backend credentials and limits token handling to trusted server paths.
- Scoped machine credentials (`clientId`/`clientSecret`) with hashed secret storage:
  reduces blast radius of external integrations and limits misuse to least-privilege scopes.
- Refresh token rotation with family revocation:
  reduces persistence of stolen/old refresh tokens and improves session abuse containment.
- Login throttling and lockout escalation:
  reduces brute-force viability and protects administrative access paths.
- Request ID propagation and audit logging:
  improves forensic traceability, accountability, and incident response quality.

These controls are intentionally integrated into daily content operations so security remains part of normal workflow execution, not a post-release add-on.
