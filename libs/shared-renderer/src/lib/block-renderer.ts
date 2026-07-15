import { BodyBlock } from '@pinnacle-mailer/shared-types';

function escapeMjmlText(value: string): string {
  let escaped = '';

  for (const char of value) {
    if (char === '&') {
      escaped += '&amp;';
      continue;
    }

    if (char === '<') {
      escaped += '&lt;';
      continue;
    }

    if (char === '>') {
      escaped += '&gt;';
      continue;
    }

    if (char === '"') {
      escaped += '&quot;';
      continue;
    }

    if (char === "'") {
      escaped += '&#39;';
      continue;
    }

    escaped += char;
  }

  return escaped;
}

function normalizeUrl(value: string | undefined): string {
  if (!value) {
    return '#';
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '#';
}

function renderTextBlock(block: BodyBlock): string {
  const content = escapeMjmlText(block.content || '');
  return `<mj-section><mj-column><mj-text>${content}</mj-text></mj-column></mj-section>`;
}

function renderImageBlock(block: BodyBlock): string {
  const src = normalizeUrl(block.imageUrl);
  const alt = escapeMjmlText(block.altText || '');
  return `<mj-section><mj-column><mj-image src="${src}" alt="${alt}" /></mj-column></mj-section>`;
}

function renderButtonBlock(block: BodyBlock): string {
  const href = normalizeUrl(block.href);
  const text = escapeMjmlText(block.content || 'Open link');
  return `<mj-section><mj-column><mj-button href="${href}" background-color="#0B2B5B" color="#ffffff">${text}</mj-button></mj-column></mj-section>`;
}

function renderDividerBlock(): string {
  return '<mj-section><mj-column><mj-divider border-color="#d1d5db" /></mj-column></mj-section>';
}

function renderSpacerBlock(): string {
  return '<mj-section><mj-column><mj-spacer height="24px" /></mj-column></mj-section>';
}

function renderBlock(block: BodyBlock): string {
  switch (block.type) {
    case 'text':
      return renderTextBlock(block);
    case 'image':
      return renderImageBlock(block);
    case 'button':
      return renderButtonBlock(block);
    case 'divider':
      return renderDividerBlock();
    case 'spacer':
      return renderSpacerBlock();
    default:
      return '';
  }
}

export function renderBlocksToMjml(blocks: BodyBlock[]): string {
  if (!blocks.length) {
    return '<mj-section><mj-column><mj-text></mj-text></mj-column></mj-section>';
  }

  return blocks.map((block) => renderBlock(block)).join('');
}
