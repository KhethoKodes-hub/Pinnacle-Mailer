import { BodyBlock } from '@pinnacle-mailer/shared-types';

export function normalizeTemplateBlocks(
  blocks: unknown[] | undefined,
  fallbackJson = '[]',
): BodyBlock[] {
  if (Array.isArray(blocks) && blocks.length > 0) {
    return sanitizeTemplateBlocks(blocks);
  }

  if (Array.isArray(blocks)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fallbackJson) as unknown;
    return Array.isArray(parsed) ? sanitizeTemplateBlocks(parsed) : [];
  } catch {
    return [];
  }
}

function sanitizeTemplateBlocks(blocks: unknown[]): BodyBlock[] {
  return blocks
    .map((value) => toBodyBlock(value))
    .filter((value): value is BodyBlock => value !== undefined);
}

function toBodyBlock(input: unknown): BodyBlock | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const id = asNonEmptyString(record.id);
  const type = asBlockType(record.type);

  if (!id || !type) {
    return undefined;
  }

  switch (type) {
    case 'text': {
      const content = asNonEmptyString(record.content);
      return content ? { id, type, content } : undefined;
    }
    case 'image': {
      const imageUrl = asNonEmptyString(record.imageUrl);
      if (!imageUrl) {
        return undefined;
      }
      const altText = asString(record.altText);
      return { id, type, imageUrl, altText };
    }
    case 'button': {
      const href = asNonEmptyString(record.href);
      const content = asNonEmptyString(record.content);
      return href && content ? { id, type, href, content } : undefined;
    }
    case 'divider':
    case 'spacer':
      return { id, type };
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBlockType(value: unknown): BodyBlock['type'] | undefined {
  if (
    value === 'text' ||
    value === 'image' ||
    value === 'button' ||
    value === 'divider' ||
    value === 'spacer'
  ) {
    return value;
  }

  return undefined;
}
