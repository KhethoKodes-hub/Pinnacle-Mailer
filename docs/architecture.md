# Pinnacle Mailer Architecture

## Assessment Context and Problem Framing

This assessment was scoped as an email operations and governance problem, not only a component-editing exercise.

Primary risks identified:

- fragmented template ownership causing inconsistent customer communications,
- high blast radius from shared-content changes without clear impact visibility,
- weak rollback and change history for incident recovery,
- insecure integration patterns where credentials or tokens can leak into less trusted clients,
- limited traceability for who changed what and when.

The resulting architecture emphasizes controlled change workflows, secure trust boundaries, and operational recovery mechanisms. Header and footer reuse is an important capability, but it sits within a broader system designed for safe, auditable, and scalable email operations.

## Goals

- Centralize header and footer management for all templates.
- Keep each template body unique and editable by non-technical users.
- Support media upload and reuse with safe email-friendly output.
- Provide version-safe publishing and rollback for controlled change management.
- Preserve auditability and actor attribution for operational accountability.
- Enforce strict authentication boundaries between browser workflows and protected APIs.

## Stack

- Monorepo: Nx
- Frontend: Next.js
- Backend: NestJS
- Persistence: Prisma + SQLite
- Shared rendering: `libs/shared-renderer`

## Core Flow

1. Editor updates template body blocks.
2. Preview composes `header + body + footer` using shared renderer.
3. Save/publish calls backend validation and persistence.
4. Any shared layout update can be impact-assessed across templates.

## Why this scales to 45+ templates

- Shared layouts avoid duplicated edits.
- Templates are versioned for rollback safety.
- Audit logs track all key mutations.
- Media assets are reusable and centrally managed.
- BFF-mediated auth boundaries reduce credential leakage risk while retaining per-user attribution.

## Assessment Outcomes

- Security posture improved through scoped client auth, session hardening, lockout controls, and request correlation.
- Operational resilience improved through publish/rollback lifecycle and deterministic demo reset workflows.
- Delivery velocity improved through reusable building blocks (layouts, media assets, preview pipeline) that reduce duplicated effort.
