# Pinnacle Mailer

Pinnacle Mailer is an authenticated email operations platform for managing templates, shared layouts, and media assets with governance controls built in.

## What This Solves

- Prevents fragmented template ownership through centralized workflows.
- Reduces release risk with version-safe publish and rollback.
- Preserves accountability with audit trails for key mutations.
- Enforces trust boundaries through a browser-facing BFF and protected backend APIs.

## Architecture At a Glance

- Monorepo orchestration: Nx
- Frontend: Next.js admin workspace
- Backend: NestJS protected API
- Persistence: Prisma + SQLite (with PostgreSQL migration path)
- Shared rendering: libs/shared-renderer
- Shared contracts: libs/shared-types

![Pinnacle Mailer Architecture](pm-architecture.svg)

## Core Product Flow

1. Editor updates template body blocks.
2. Preview composes header + body + footer with shared rendering.
3. Save and publish flow validates and persists through backend services.
4. Shared layout changes can be impact-assessed across templates.
5. Version snapshots and audit logs support rollback and investigation.

## Why This Scales Beyond 45 Templates

- Shared layouts eliminate repetitive header/footer edits.
- Reusable media assets reduce duplicate uploads and inconsistencies.
- Structured template versions keep release and rollback predictable.
- Audit records keep operator and client actions traceable.
- BFF-mediated auth boundaries support secure growth across teams.
- Data layer roadmap to PostgreSQL supports larger workloads and concurrency.

## Monorepo Layout

- apps/backend: NestJS API, auth, templates, layouts, media, audit, health.
- apps/frontend: Next.js admin UI and BFF routes.
- libs/shared-renderer: MJML composition and preview rendering.
- libs/shared-types: shared TypeScript types and DTO contracts.
- docs: architecture, demo flow, and operational notes.

## Local Development

From the repository root:

- npm install
- npm run db:demo-reset
- npm run dev:app

Key local URLs:

- Frontend: http://localhost:4200
- Backend Swagger: http://localhost:3000/api/docs

## Documentation

- docs/architecture.md
- docs/demo.md
- docs/demo-script.md
- docs/security.md
- docs/media-strategy.md
