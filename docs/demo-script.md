# Pinnacle Mailer Demo Script

## 1. Project Overview

**Pinnacle Mailer** is a monorepo email template management solution built with:

- `Nx` monorepo orchestration
- `NestJS` backend API
- `Next.js` frontend admin workspace
- `Prisma + SQLite` persistence
- Shared rendering logic in `libs/shared-renderer`
- Shared DTO types in `libs/shared-types`

The app is designed for secure template editing, shared layout reuse, preview rendering, version-safe publish/rollback, media asset management, and audit logging.

---

## 2. Demo Goals

During the demo, highlight:

1. How the full stack starts and how dev mode runs.
2. Backend architecture and API security.
3. Frontend admin flow, including session handling and BFF forwarding.
4. Shared MJML rendering for email previews.
5. Data model decisions: templates, layouts, versions, media, audits.
6. Key implementation touchpoints for template CRUD, publish/rollback, and media management.

---

## 3. Run the App

### Recommended local commands

From the repo root:

- `npm install`
- `npm run db:demo-reset`
- `npm run dev:app`

### What these do

- `npm run db:demo-reset` resets the database, applies migrations, and seeds demo data.
- `npm run dev:backend` starts the NestJS backend.
- `npm run dev:frontend` starts the Next.js admin frontend.
- `npm run dev:app` runs both frontend and backend concurrently.

### Backend API docs

Once running, visit:

- `http://localhost:3000/api/docs`

This exposes Swagger for the protected backend API surface.

---

## 4. Architecture Summary

### Monorepo layout

- `apps/backend` - NestJS server and Prisma integration.
- `apps/frontend` - Next.js admin UI and BFF routes.
- `libs/shared-renderer` - MJML composition and preview rendering.
- `libs/shared-types` - shared TypeScript models and request/response shapes.

The backend and frontend share types and rendering utilities through workspace imports.

### Security and trust boundaries

- Frontend users authenticate via `NextAuth` and credentials.
- The browser uses a BFF layer under `apps/frontend/src/app/api/bff`.
- BFF forwards requests to the backend with bearer access tokens.
- Backend uses `AccessTokenGuard` and scope checks to enforce API authorization.

---

## 5. Backend Key Files

### `apps/backend/src/main.ts`

This is the NestJS bootstrap file.

- Sets global prefix: `api`
- Enables CORS
- Adds validation pipe with strict whitelisting
- Serves static assets from `storage`
- Exposes Swagger at `/api/docs`

### `apps/backend/src/app/app.module.ts`

This is the DI root module.

Imports:

- `ConfigModule` for environment configuration
- `LoggerModule` for structured request logs with pino
- `ThrottlerModule` for rate limiting
- `PrismaModule` for DB access
- Feature modules: `Auth`, `Users`, `Audit`, `Layouts`, `Templates`, `Media`, `Health`

It also installs `ThrottlerGuard` globally.

### `apps/backend/prisma/schema.prisma`

Important models:

- `EmailLayout` - header/footer MJML and version metadata.
- `EmailTemplate` - templates with `bodyMjml`, `blocksJson`, `status`, and layout references.
- `TemplateVersion` - version history for rollback.
- `MediaAsset` - uploaded media details and metadata.
- `AuditLog` - action-based audit trail for templates, layouts, media, auth sessions, and API clients.

This schema drives both the backend persistence and the audit/rollback story.

### `apps/backend/src/modules/templates/templates.controller.ts`

Routes for template management:

- `GET /api/templates` - list templates
- `POST /api/templates` - create a template
- `PATCH /api/templates/:id` - update a template
- `POST /api/templates/:id/publish` - publish a template version
- `POST /api/templates/:id/rollback/:version` - rollback to a prior version
- `GET /api/templates/:id/export-html` - render and export HTML
- `POST /api/templates/preview` - preview MJML composed from header/body/footer

Each route is protected by `AccessTokenGuard` and scoped access.

### `apps/backend/src/modules/templates/templates.service.ts`

Implements the template lifecycle:

- Normalizes and validates block data
- Generates `bodyMjml` from structured blocks
- Saves templates and versions in Prisma
- Logs audit events for create/update/publish/rollback
- Uses shared renderer for preview/export

This is a core business implementation point for the demo.

### `apps/backend/src/modules/auth/auth.module.ts`

Auth module wiring exposes login and refresh capabilities.

- Global provider for `AccessTokenGuard`
- `AuthService` handles client tokens, user login, refresh tokens, and logout
- Includes audit logging for auth events and lockout detection

### `apps/backend/src/modules/auth/auth.service.ts`

Key security patterns:

- Password hashing with SHA-256
- Account lockout on repeated failures
- Refresh token sessions with hash comparison and reuse detection
- JWT access tokens with scopes

This is the backend’s security implementation story.

### `apps/backend/src/common/guards/access-token.guard.ts`

This guard:

- Reads `Authorization: Bearer` header
- Verifies JWT via `AuthService`
- Attaches principal to the request
- Checks endpoint scopes and `admin` access

It enforces the boundary between the frontend BFF and protected backend APIs.

---

## 6. Frontend Key Files

### `apps/frontend/src/app/layout.tsx`

Root layout for the admin UI.

- Wraps all pages in `AppSessionProvider`
- Defines app metadata for the browser

### `apps/frontend/src/app/page.tsx`

Public landing page.

- Describes the admin workspace and security model
- Links to `/login`

### `apps/frontend/src/app/admin/page.tsx`

Admin root route.

- Redirects to `/admin/templates`

### Admin feature pages

These are the main admin experiences:

- `apps/frontend/src/app/admin/templates/page.tsx`
  - Templates list, create/update, preview, save, publish, rollback
- `apps/frontend/src/app/admin/layouts/page.tsx`
  - Shared header/footer management and impact analysis
- `apps/frontend/src/app/admin/media/page.tsx`
  - Media upload and metadata editing

These pages show the browser workflow for editors and administrators.

### `apps/frontend/src/lib/auth-options.ts`

NextAuth options and credential provider.

- Uses backend login endpoint `/api/auth/login`
- Stores access and refresh tokens in JWT session
- Refreshes tokens automatically before expiration

This file is the frontend auth integration point.

### `apps/frontend/src/lib/session.ts`

Provides `getAuthSession()` for server-side page data and BFF route helpers.

### `apps/frontend/src/lib/env.ts`

Resolves `BACKEND_API_BASE_URL` from environment variables.

This is required for BFF forwarding and backend API calls.

### `apps/frontend/src/lib/bff.ts`

BFF helper for server-side routes.

- Forwards incoming requests to the backend API
- Adds `x-request-id` and authorization headers
- Supports JSON and multipart requests

This is the key trust boundary for browser requests.

### `apps/frontend/src/lib/client-api.ts`

Client-side fetch helper.

- Wraps fetch calls for admin UI pages
- Detects session expiration and translation to re-auth flows

This is the user-facing error handling layer.

---

## 7. Shared Render and Types

### `libs/shared-renderer/src/index.ts`

Exports shared rendering utilities.

- `composeMjml(request)` composes header/body/footer into one MJML document
- `renderPreview(request)` converts MJML to HTML and text

### `libs/shared-renderer/src/lib/email-renderer.ts`

Uses `mjml` to render previews.

This is the shared template rendering capability used by both backend preview and HTML export.

### `libs/shared-types/src/lib/email-template.types.ts`

Shared DTOs and domain types:

- `EmailTemplateDraft`
- `PreviewRequest`
- `PreviewResult`
- `LayoutSnapshot`
- `BodyBlock`
- `LayoutVisualModel`

These shared types keep API contracts aligned across frontend and backend.

---

## 8. Demo Flow Script

### Step 1: Setup and start

1. Confirm `BACKEND_API_BASE_URL` is set in the frontend environment.
2. Run `npm install` if dependencies are missing.
3. Run `npm run db:demo-reset`.
4. Run `npm run dev:app`.
5. Open the frontend admin workspace at `http://localhost:4200`.
6. Open Swagger at `http://localhost:3000/api/docs`.

### Step 2: Show login and auth

- Walk through `/login`.
- Explain `apps/frontend/src/lib/auth-options.ts` and how credentials are exchanged for JWT tokens.
- Mention refresh token flow and session expiry handling.

### Step 3: Show admin pages and BFF flow

- Open `/admin/templates`.
- Note that client requests go through `apps/frontend/src/app/api/bff/*`.
- Show how `apps/frontend/src/lib/bff.ts` forwards requests to the backend with the active access token.

### Step 4: Show templates and preview

- Open the templates screen.
- Demonstrate editing a template.
- Explain how block data is normalized and converted into MJML.
- Mention `apps/backend/src/modules/templates/templates.service.ts` and `libs/shared-renderer/src/lib/email-renderer.ts`.

### Step 5: Show shared layouts

- Open `/admin/layouts`.
- Discuss header/footer reuse.
- Explain impact analysis: shared layouts can affect multiple templates.
- Mention `EmailLayout` and `TemplateVersion` in `schema.prisma`.

### Step 6: Show media upload

- Open `/admin/media`.
- Show uploading an image and editing alt/caption metadata.
- Note how media assets can later be referenced inside template blocks.

### Step 7: Publish and rollback

- Publish a template.
- Explain how `templates.service.ts` creates a `TemplateVersion` snapshot.
- Show rollback to a prior version.
- Highlight audit logging around create/update/publish/rollback.

### Step 8: Backend API docs and health

- Open Swagger docs again.
- Note the protected API surface and scope requirements.
- Show `apps/backend/src/modules/health` or health endpoint if available.

---

## 9. What to Mention

- Monorepo approach with shared types and renderer libs.
- BFF security pattern to keep secrets off the browser.
- Template versioning and rollback safety.
- Audit logging for business actions and auth events.
- Shared layout reuse to reduce duplicate header/footer changes.
- Media asset management and static storage serving.
- How the system balances flexible email editing with controlled release.

---

## 10. Notes for the Demo

- Emphasize the clean separation of concerns: frontend UI, backend business logic, shared rendering, and shared types.
- Name the key files during walkthrough; point to `main.ts`, `app.module.ts`, `templates.service.ts`, `auth-options.ts`, `bff.ts`, `email-renderer.ts`, and `schema.prisma`.
- Keep the user story simple: "edit template → preview render → publish → audit/rollback".
- Use `npm run db:demo-reset` before the walkthrough if you want a consistent fresh state.

---

## 11. Quick file reference

- `README.md`
- `docs/architecture.md`
- `apps/backend/src/main.ts`
- `apps/backend/src/app/app.module.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/modules/auth/auth.service.ts`
- `apps/backend/src/modules/auth/auth.module.ts`
- `apps/backend/src/common/guards/access-token.guard.ts`
- `apps/backend/src/modules/templates/templates.controller.ts`
- `apps/backend/src/modules/templates/templates.service.ts`
- `apps/frontend/src/app/layout.tsx`
- `apps/frontend/src/app/page.tsx`
- `apps/frontend/src/app/admin/page.tsx`
- `apps/frontend/src/app/admin/templates/page.tsx`
- `apps/frontend/src/app/admin/layouts/page.tsx`
- `apps/frontend/src/app/admin/media/page.tsx`
- `apps/frontend/src/lib/auth-options.ts`
- `apps/frontend/src/lib/bff.ts`
- `apps/frontend/src/lib/client-api.ts`
- `libs/shared-renderer/src/lib/email-renderer.ts`
- `libs/shared-renderer/src/index.ts`
- `libs/shared-types/src/lib/email-template.types.ts`

---

### End of demo script

Use this document as the guide for your walkthrough and focus on the implementation flow from login to publish and rollback.