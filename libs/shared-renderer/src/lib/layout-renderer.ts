import { LayoutType, LayoutVisualModel } from '@pinnacle-mailer/shared-types';

const emptyModel: LayoutVisualModel = {
  accentColor: '#0B2B5B',
  backgroundColor: '#F8FAFC',
  textColor: '#1F2937',
  blocks: [],
};

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asColor(value: string | undefined, fallback: string): string {
  const input = (value || '').trim();
  return /^#[a-fA-F0-9]{6}$/.test(input) ? input : fallback;
}

function normalizeHref(value: string | undefined): string {
  const input = (value || '').trim();
  if (!input) {
    return '#';
  }

  return /^https?:\/\//i.test(input) ? input : '#';
}

export function renderLayoutModelToMjml(
  model: LayoutVisualModel | undefined,
  type: LayoutType,
): string {
  const normalized = model || emptyModel;
  const accentColor = asColor(normalized.accentColor, emptyModel.accentColor);
  const backgroundColor = asColor(normalized.backgroundColor, emptyModel.backgroundColor);
  const textColor = asColor(normalized.textColor, emptyModel.textColor);

  const blocks = normalized.blocks
    .map((block) => {
      switch (block.type) {
        case 'brand': {
          const logoUrl = (block.logoUrl || '').trim();
          const text = escapeText(block.text || 'Pinnacle Mailer');
          const logoSection = logoUrl
            ? `<mj-image width="140px" src="${escapeText(logoUrl)}" alt="${text}" />`
            : '';
          return `<mj-section background-color="${backgroundColor}" padding="8px 0"><mj-column>${logoSection}<mj-text color="${textColor}" font-size="20px" font-weight="700" align="center">${text}</mj-text></mj-column></mj-section>`;
        }
        case 'nav_links': {
          const links = (block.links || [])
            .filter((entry) => entry.label.trim() && entry.href.trim())
            .map(
              (entry) =>
                `<a href="${normalizeHref(entry.href)}" style="color:${accentColor};text-decoration:none;margin:0 10px;">${escapeText(entry.label)}</a>`,
            )
            .join('');
          return `<mj-section background-color="${backgroundColor}" padding="4px 0"><mj-column><mj-text align="center" color="${textColor}" font-size="14px">${links}</mj-text></mj-column></mj-section>`;
        }
        case 'legal': {
          const text = escapeText(block.text || 'You are receiving this email because you opted in.');
          return `<mj-section background-color="${backgroundColor}" padding="6px 0"><mj-column><mj-text align="center" color="${textColor}" font-size="12px">${text}</mj-text></mj-column></mj-section>`;
        }
        case 'social': {
          const links = (block.links || [])
            .filter((entry) => entry.label.trim() && entry.href.trim())
            .map(
              (entry) =>
                `<a href="${normalizeHref(entry.href)}" style="color:${accentColor};text-decoration:none;margin:0 6px;">${escapeText(entry.label)}</a>`,
            )
            .join('');
          return `<mj-section background-color="${backgroundColor}" padding="4px 0"><mj-column><mj-text align="center" color="${textColor}" font-size="13px">${links}</mj-text></mj-column></mj-section>`;
        }
        case 'divider':
          return `<mj-section background-color="${backgroundColor}" padding="2px 0"><mj-column><mj-divider border-color="${accentColor}" /></mj-column></mj-section>`;
        case 'spacer':
          return `<mj-section background-color="${backgroundColor}"><mj-column><mj-spacer height="20px" /></mj-column></mj-section>`;
        default:
          return '';
      }
    })
    .join('');

  if (blocks.trim().length > 0) {
    return blocks;
  }

  if (type === 'header') {
    return `<mj-section background-color="${backgroundColor}"><mj-column><mj-text align="center" color="${textColor}" font-size="20px" font-weight="700">Pinnacle Mailer</mj-text></mj-column></mj-section>`;
  }

  return `<mj-section background-color="${backgroundColor}"><mj-column><mj-divider border-color="${accentColor}" /><mj-text align="center" color="${textColor}" font-size="12px">Footer content</mj-text></mj-column></mj-section>`;
}
