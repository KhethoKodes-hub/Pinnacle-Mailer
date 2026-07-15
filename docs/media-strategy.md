# Media Strategy

## Upload Pipeline

- Endpoint: `POST /api/media/upload`
- Input: multipart file field `file`
- Validation: image mime-only and size limit (5 MB)
- Storage v1: local disk (`storage/uploads`)

## Metadata

- Stored fields: file name, original name, mime type, size, alt text, caption.
- Soft delete is supported for asset lifecycle management.

## Editing UX

- Non-technical users choose image blocks from Media Library.
- Alt text and caption can be edited for accessibility and context.

## Portability

Storage is behind a service abstraction so local disk can move to object storage in a later phase without rewriting editor flows.

## Outcome Summary

Media management in this solution is positioned as a governance and quality control capability, not only an upload mechanism.

- Accessibility: editable alt text supports better inclusive email rendering.
- Brand consistency: centrally approved assets reduce off-brand campaign variance.
- Operational confidence: metadata updates and reuse reduce repetitive manual edits across templates.
- Platform readiness: storage abstraction keeps the workflow stable while allowing future migration to cloud object storage.
