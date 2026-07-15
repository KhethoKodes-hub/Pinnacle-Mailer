'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminJson, SessionExpiredError } from '../../../lib/client-api';
import type { LayoutVisualBlock, LayoutVisualLink, LayoutVisualModel } from '@pinnacle-mailer/shared-types';

type LayoutItem = {
  id: string;
  name: string;
  type: 'HEADER' | 'FOOTER';
  mjml: string;
  layoutModel?: LayoutVisualModel;
  version: number;
  updatedAt: string;
};

type LayoutImpact = {
  affectedTemplates: Array<{ id: string; name: string; slug: string }>;
  affectedCount: number;
};

type PreviewResult = {
  html: string;
  text: string;
  errors: string[];
};

type VisualBlockType = LayoutVisualBlock['type'];

const defaultModel: LayoutVisualModel = {
  accentColor: '#640098',
  backgroundColor: '#F8FAFC',
  textColor: '#1F2937',
  blocks: [],
};

const HISTORY_LIMIT = 50;

function cloneLayoutModel(model: LayoutVisualModel): LayoutVisualModel {
  return {
    accentColor: model.accentColor,
    backgroundColor: model.backgroundColor,
    textColor: model.textColor,
    blocks: model.blocks.map((block) => ({
      ...block,
      links: block.links?.map((link) => ({ ...link })),
    })),
  };
}

type LayoutModelValidation = {
  summary: string[];
  byBlockId: Record<string, string[]>;
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateLayoutModel(model: LayoutVisualModel): LayoutModelValidation {
  const byBlockId: Record<string, string[]> = {};
  const summary: string[] = [];

  model.blocks.forEach((block, index) => {
    const messages: string[] = [];

    if (block.type === 'brand') {
      if (!(block.text || '').trim()) {
        messages.push('Brand text is required.');
      }

      const logoUrl = (block.logoUrl || '').trim();
      if (logoUrl && !isHttpUrl(logoUrl)) {
        messages.push('Logo URL must be a valid http or https URL.');
      }
    }

    if (block.type === 'nav_links' || block.type === 'social') {
      const links = block.links || [];
      if (links.length === 0) {
        messages.push('Add at least one link.');
      }

      links.forEach((link, linkIndex) => {
        if (!link.label.trim()) {
          messages.push(`Link ${linkIndex + 1}: label is required.`);
        }

        if (!link.href.trim()) {
          messages.push(`Link ${linkIndex + 1}: URL is required.`);
          return;
        }

        if (!isHttpUrl(link.href.trim())) {
          messages.push(`Link ${linkIndex + 1}: URL must be a valid http or https URL.`);
        }
      });
    }

    if (messages.length > 0) {
      byBlockId[block.id] = messages;
      summary.push(`Block ${index + 1} (${block.type}): ${messages[0]}`);
    }
  });

  return {
    summary,
    byBlockId,
  };
}

function blockId(): string {
  return `layout_block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function linkId(): string {
  return `layout_link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultLayoutModel(type: 'HEADER' | 'FOOTER'): LayoutVisualModel {
  if (type === 'HEADER') {
    return {
      ...defaultModel,
      blocks: [
        { id: blockId(), type: 'brand', text: 'Pinnacle Mailer' },
        {
          id: blockId(),
          type: 'nav_links',
          links: [
            { id: linkId(), label: 'Rewards', href: 'https://example.com/rewards' },
            { id: linkId(), label: 'Profile', href: 'https://example.com/profile' },
          ],
        },
      ],
    };
  }

  return {
    ...defaultModel,
    blocks: [
      { id: blockId(), type: 'divider' },
      { id: blockId(), type: 'legal', text: 'You are receiving this email because you opted in.' },
      {
        id: blockId(),
        type: 'social',
        links: [
          { id: linkId(), label: 'Facebook', href: 'https://facebook.com' },
          { id: linkId(), label: 'Instagram', href: 'https://instagram.com' },
        ],
      },
    ],
  };
}

function decodeText(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .trim();
}

function stripTags(value: string): string {
  return decodeText(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function firstMatch(source: string, regex: RegExp): string | undefined {
  const result = regex.exec(source);
  return result?.[1]?.trim();
}

function extractAnchorLinks(mjml: string): LayoutVisualLink[] {
  const matches = [...mjml.matchAll(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi)];
  return matches
    .map((entry) => {
      const href = (entry[1] || '').trim();
      const label = stripTags(entry[2] || '');
      if (!href || !label) {
        return undefined;
      }

      return {
        id: linkId(),
        label,
        href,
      };
    })
    .filter((entry): entry is LayoutVisualLink => Boolean(entry));
}

function inferLayoutModelFromMjml(type: 'HEADER' | 'FOOTER', mjml: string): LayoutVisualModel {
  const accentColor = firstMatch(mjml, /<mj-divider[^>]*border-color="(#[0-9A-F]{6})"/i) || defaultModel.accentColor;
  const backgroundColor = firstMatch(mjml, /<mj-section[^>]*background-color="(#[0-9A-F]{6})"/i) || defaultModel.backgroundColor;
  const textColor = firstMatch(mjml, /<mj-text[^>]*color="(#[0-9A-F]{6})"/i) || defaultModel.textColor;
  const blocks: LayoutVisualBlock[] = [];

  const imageUrl = firstMatch(mjml, /<mj-image[^>]*src="([^"]+)"/i);
  const headingText = stripTags(firstMatch(mjml, /<mj-text[^>]*font-size="20px"[^>]*>([\s\S]*?)<\/mj-text>/i) || '');
  const fallbackText = stripTags(firstMatch(mjml, /<mj-text[^>]*>([\s\S]*?)<\/mj-text>/i) || '');

  if (type === 'HEADER') {
    if (imageUrl || headingText || fallbackText) {
      blocks.push({
        id: blockId(),
        type: 'brand',
        text: headingText || fallbackText || 'Pinnacle Mailer',
        logoUrl: imageUrl,
      });
    }

    const links = extractAnchorLinks(mjml);
    if (links.length > 0) {
      blocks.push({
        id: blockId(),
        type: 'nav_links',
        links,
      });
    }
  } else {
    if (/<mj-divider/i.test(mjml)) {
      blocks.push({ id: blockId(), type: 'divider' });
    }

    const links = extractAnchorLinks(mjml);
    if (links.length > 0) {
      blocks.push({
        id: blockId(),
        type: 'social',
        links,
      });
    }

    if (fallbackText) {
      blocks.push({
        id: blockId(),
        type: 'legal',
        text: fallbackText,
      });
    }
  }

  if (blocks.length === 0) {
    return defaultLayoutModel(type);
  }

  return {
    accentColor,
    backgroundColor,
    textColor,
    blocks,
  };
}

function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeHref(value: string | undefined): string {
  const input = (value || '').trim();
  if (!input) {
    return '#';
  }

  return /^https?:\/\//i.test(input) ? input : '#';
}

function renderLayoutModelToMjmlClient(model: LayoutVisualModel, type: 'header' | 'footer'): string {
  const blocks = model.blocks
    .map((block) => {
      switch (block.type) {
        case 'brand': {
          const logoUrl = (block.logoUrl || '').trim();
          const text = escapeText(block.text || 'Pinnacle Mailer');
          const logoSection = logoUrl
            ? `<mj-image width="140px" src="${escapeText(logoUrl)}" alt="${text}" />`
            : '';
          return `<mj-section background-color="${model.backgroundColor}" padding="8px 0"><mj-column>${logoSection}<mj-text color="${model.textColor}" font-size="20px" font-weight="700" align="center">${text}</mj-text></mj-column></mj-section>`;
        }
        case 'nav_links': {
          const links = (block.links || [])
            .filter((entry) => entry.label.trim() && entry.href.trim())
            .map(
              (entry) =>
                `<a href="${normalizeHref(entry.href)}" style="color:${model.accentColor};text-decoration:none;margin:0 10px;">${escapeText(entry.label)}</a>`,
            )
            .join('');
          return `<mj-section background-color="${model.backgroundColor}" padding="4px 0"><mj-column><mj-text align="center" color="${model.textColor}" font-size="14px">${links}</mj-text></mj-column></mj-section>`;
        }
        case 'legal':
          return `<mj-section background-color="${model.backgroundColor}" padding="6px 0"><mj-column><mj-text align="center" color="${model.textColor}" font-size="12px">${escapeText(block.text || '')}</mj-text></mj-column></mj-section>`;
        case 'social': {
          const links = (block.links || [])
            .filter((entry) => entry.label.trim() && entry.href.trim())
            .map(
              (entry) =>
                `<a href="${normalizeHref(entry.href)}" style="color:${model.accentColor};text-decoration:none;margin:0 6px;">${escapeText(entry.label)}</a>`,
            )
            .join('');
          return `<mj-section background-color="${model.backgroundColor}" padding="4px 0"><mj-column><mj-text align="center" color="${model.textColor}" font-size="13px">${links}</mj-text></mj-column></mj-section>`;
        }
        case 'divider':
          return `<mj-section background-color="${model.backgroundColor}" padding="2px 0"><mj-column><mj-divider border-color="${model.accentColor}" /></mj-column></mj-section>`;
        case 'spacer':
          return `<mj-section background-color="${model.backgroundColor}"><mj-column><mj-spacer height="20px" /></mj-column></mj-section>`;
        default:
          return '';
      }
    })
    .join('');

  if (blocks.trim().length > 0) {
    return blocks;
  }

  if (type === 'header') {
    return `<mj-section><mj-column><mj-text align="center">Pinnacle Mailer</mj-text></mj-column></mj-section>`;
  }

  return `<mj-section><mj-column><mj-text align="center">Footer content</mj-text></mj-column></mj-section>`;
}

function addBlock(model: LayoutVisualModel, type: VisualBlockType): LayoutVisualModel {
  const block = createVisualBlock(type);

  return {
    ...model,
    blocks: [...model.blocks, block],
  };
}

function createVisualBlock(type: VisualBlockType): LayoutVisualBlock {
  if (type === 'brand') {
    return { id: blockId(), type, text: 'Brand title' };
  }

  if (type === 'nav_links' || type === 'social') {
    return {
      id: blockId(),
      type,
      links: [{ id: linkId(), label: 'Label', href: 'https://example.com' }],
    };
  }

  if (type === 'legal') {
    return { id: blockId(), type, text: 'Legal copy' };
  }

  return { id: blockId(), type };
}

function updateBlock(model: LayoutVisualModel, id: string, patch: Partial<LayoutVisualBlock>): LayoutVisualModel {
  return {
    ...model,
    blocks: model.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
  };
}

function removeBlock(model: LayoutVisualModel, id: string): LayoutVisualModel {
  return {
    ...model,
    blocks: model.blocks.filter((block) => block.id !== id),
  };
}

function moveBlock(model: LayoutVisualModel, id: string, direction: -1 | 1): LayoutVisualModel {
  const index = model.blocks.findIndex((block) => block.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= model.blocks.length) {
    return model;
  }

  const next = [...model.blocks];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);

  return {
    ...model,
    blocks: next,
  };
}

function moveBlockToEdge(model: LayoutVisualModel, id: string, position: 'top' | 'bottom'): LayoutVisualModel {
  const index = model.blocks.findIndex((block) => block.id === id);
  if (index < 0) {
    return model;
  }

  const target = position === 'top' ? 0 : model.blocks.length - 1;
  if (index === target) {
    return model;
  }

  const next = [...model.blocks];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);

  return {
    ...model,
    blocks: next,
  };
}

function duplicateBlock(model: LayoutVisualModel, id: string): LayoutVisualModel {
  const index = model.blocks.findIndex((block) => block.id === id);
  if (index < 0) {
    return model;
  }

  const source = model.blocks[index];
  const duplicated: LayoutVisualBlock = {
    ...source,
    id: blockId(),
    links: source.links?.map((link) => ({ ...link, id: linkId() })),
  };

  const next = [...model.blocks];
  next.splice(index + 1, 0, duplicated);

  return {
    ...model,
    blocks: next,
  };
}

function updateBlockLinks(model: LayoutVisualModel, blockIdValue: string, links: LayoutVisualLink[]): LayoutVisualModel {
  return updateBlock(model, blockIdValue, { links });
}

function setBlockLinkValue(
  model: LayoutVisualModel,
  block: LayoutVisualBlock,
  linkIndex: number,
  key: 'label' | 'href',
  value: string,
): LayoutVisualModel {
  const links = [...(block.links || [])];
  links[linkIndex] = { ...links[linkIndex], [key]: value };
  return updateBlockLinks(model, block.id, links);
}

function removeBlockLink(model: LayoutVisualModel, block: LayoutVisualBlock, targetId: string): LayoutVisualModel {
  const links = (block.links || []).filter((entry) => entry.id !== targetId);
  return updateBlockLinks(model, block.id, links);
}

function appendBlockLink(model: LayoutVisualModel, block: LayoutVisualBlock): LayoutVisualModel {
  const links = [...(block.links || []), { id: linkId(), label: 'Label', href: 'https://example.com' }];
  return updateBlockLinks(model, block.id, links);
}

type CreateLayoutFormProps = {
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  type: 'HEADER' | 'FOOTER';
  onTypeChange: (nextType: 'HEADER' | 'FOOTER') => void;
  model: LayoutVisualModel;
  setModel: React.Dispatch<React.SetStateAction<LayoutVisualModel>>;
  isSaving: boolean;
  submitCreate: (event: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
};

function CreateLayoutForm({
  name,
  setName,
  type,
  onTypeChange,
  model,
  setModel,
  isSaving,
  submitCreate,
}: Readonly<CreateLayoutFormProps>) {
  return (
    <form className="auth-form" onSubmit={submitCreate}>
      <strong>Create layout</strong>
      <input placeholder="Layout name" value={name} onChange={(event) => setName(event.target.value)} required />
      <select
        value={type}
        onChange={(event) => {
          const nextType = event.target.value as 'HEADER' | 'FOOTER';
          onTypeChange(nextType);
        }}
      >
        <option value="HEADER">Header</option>
        <option value="FOOTER">Footer</option>
      </select>

      <div className="action-row">
        <label>
          <span>Accent</span>
          <input
            type="color"
            value={model.accentColor}
            onChange={(event) => setModel((current) => ({ ...current, accentColor: event.target.value }))}
          />
        </label>
        <label>
          <span>Background</span>
          <input
            type="color"
            value={model.backgroundColor}
            onChange={(event) => setModel((current) => ({ ...current, backgroundColor: event.target.value }))}
          />
        </label>
        <label>
          <span>Text</span>
          <input
            type="color"
            value={model.textColor}
            onChange={(event) => setModel((current) => ({ ...current, textColor: event.target.value }))}
          />
        </label>
      </div>

      <button className="primary-button" type="submit" disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Create layout'}
      </button>
    </form>
  );
}

type EditLayoutSectionProps = {
  editingId: string | null;
  editingName: string;
  setEditingName: React.Dispatch<React.SetStateAction<string>>;
  editingType: 'HEADER' | 'FOOTER';
  onEditingTypeChange: (nextType: 'HEADER' | 'FOOTER') => void;
  isSaving: boolean;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;
};

function EditLayoutSection({
  editingId,
  editingName,
  setEditingName,
  editingType,
  onEditingTypeChange,
  isSaving,
  saveEdit,
  cancelEdit,
}: Readonly<EditLayoutSectionProps>) {
  if (!editingId) {
    return null;
  }

  return (
    <section className="editor-panel">
      <h3>Edit layout</h3>
      <div className="auth-form">
        <input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
        <select
          value={editingType}
          onChange={(event) => {
            const nextType = event.target.value as 'HEADER' | 'FOOTER';
            onEditingTypeChange(nextType);
          }}
        >
          <option value="HEADER">Header</option>
          <option value="FOOTER">Footer</option>
        </select>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={() => void saveEdit()} disabled={isSaving}>
            Save
          </button>
          <button className="secondary-button" type="button" onClick={cancelEdit} disabled={isSaving}>
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

type LayoutBlocksEditorProps = {
  activeType: 'HEADER' | 'FOOTER';
  activeModel: LayoutVisualModel;
  updateActiveModel: (next: LayoutVisualModel) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoActiveModel: () => void;
  redoActiveModel: () => void;
  validationSummary: string[];
  validationByBlockId: Record<string, string[]>;
};

function LayoutBlocksEditor({
  activeType,
  activeModel,
  updateActiveModel,
  canUndo,
  canRedo,
  undoActiveModel,
  redoActiveModel,
  validationSummary,
  validationByBlockId,
}: Readonly<LayoutBlocksEditorProps>) {
  return (
    <section className="editor-panel">
      <h3>Layout blocks ({activeType.toLowerCase()})</h3>
      <div className="action-row" style={{ marginBottom: 10 }}>
        <button type="button" className="secondary-button" onClick={undoActiveModel} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="secondary-button" onClick={redoActiveModel} disabled={!canRedo}>
          Redo
        </button>
        <button type="button" className="secondary-button" onClick={() => updateActiveModel(addBlock(activeModel, 'brand'))}>
          + Brand
        </button>
        <button type="button" className="secondary-button" onClick={() => updateActiveModel(addBlock(activeModel, 'nav_links'))}>
          + Nav Links
        </button>
        <button type="button" className="secondary-button" onClick={() => updateActiveModel(addBlock(activeModel, 'legal'))}>
          + Legal
        </button>
        <button type="button" className="secondary-button" onClick={() => updateActiveModel(addBlock(activeModel, 'social'))}>
          + Social
        </button>
        <button type="button" className="secondary-button" onClick={() => updateActiveModel(addBlock(activeModel, 'divider'))}>
          + Divider
        </button>
        <button type="button" className="secondary-button" onClick={() => updateActiveModel(addBlock(activeModel, 'spacer'))}>
          + Spacer
        </button>
      </div>

      {validationSummary.length > 0 ? (
        <div className="table-wrap" style={{ marginBottom: 10, padding: 12 }}>
          <strong>Validation checks</strong>
          <ul>
            {validationSummary.map((message, index) => (
              <li key={`${message}-${index}`} className="form-error">
                {message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {activeModel.blocks.map((block, index) => (
        <div key={block.id} className="table-wrap" style={{ padding: 12, marginBottom: 10 }}>
          <div className="action-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>
              {index + 1}. {block.type}
            </strong>
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateActiveModel(moveBlockToEdge(activeModel, block.id, 'top'))}
                disabled={index === 0}
              >
                Top
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateActiveModel(moveBlock(activeModel, block.id, -1))}
                disabled={index === 0}
              >
                Up
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateActiveModel(moveBlock(activeModel, block.id, 1))}
                disabled={index === activeModel.blocks.length - 1}
              >
                Down
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateActiveModel(moveBlockToEdge(activeModel, block.id, 'bottom'))}
                disabled={index === activeModel.blocks.length - 1}
              >
                Bottom
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateActiveModel(duplicateBlock(activeModel, block.id))}
              >
                Duplicate
              </button>
              <button type="button" className="secondary-button" onClick={() => updateActiveModel(removeBlock(activeModel, block.id))}>
                Remove
              </button>
            </div>
          </div>

          {block.type === 'brand' ? (
            <div className="auth-form">
              <input
                placeholder="Brand text"
                value={block.text || ''}
                onChange={(event) => updateActiveModel(updateBlock(activeModel, block.id, { text: event.target.value }))}
              />
              <input
                placeholder="Optional logo URL"
                value={block.logoUrl || ''}
                onChange={(event) => updateActiveModel(updateBlock(activeModel, block.id, { logoUrl: event.target.value }))}
              />
            </div>
          ) : null}

          {block.type === 'legal' ? (
            <textarea
              className="editor-textarea"
              rows={3}
              value={block.text || ''}
              onChange={(event) => updateActiveModel(updateBlock(activeModel, block.id, { text: event.target.value }))}
            />
          ) : null}

          {block.type === 'nav_links' || block.type === 'social' ? (
            <div className="auth-form">
              {(block.links || []).map((link, linkIndex) => (
                <div className="action-row" key={link.id}>
                  <input
                    placeholder="Label"
                    value={link.label}
                    onChange={(event) =>
                      updateActiveModel(setBlockLinkValue(activeModel, block, linkIndex, 'label', event.target.value))
                    }
                  />
                  <input
                    placeholder="https://..."
                    value={link.href}
                    onChange={(event) =>
                      updateActiveModel(setBlockLinkValue(activeModel, block, linkIndex, 'href', event.target.value))
                    }
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => updateActiveModel(removeBlockLink(activeModel, block, link.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="secondary-button"
                onClick={() => updateActiveModel(appendBlockLink(activeModel, block))}
              >
                Add link
              </button>
            </div>
          ) : null}

          {validationByBlockId[block.id]?.length ? (
            <ul>
              {validationByBlockId[block.id].map((message, messageIndex) => (
                <li key={`${block.id}-${message}-${messageIndex}`} className="form-error">
                  {message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}

type LayoutsTableProps = {
  layouts: LayoutItem[];
  impact: Record<string, number>;
  isSaving: boolean;
  beginEdit: (layout: LayoutItem) => void;
};

function LayoutsTable({ layouts, impact, isSaving, beginEdit }: Readonly<LayoutsTableProps>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Version</th>
            <th>Used by</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {layouts.map((layout) => (
            <tr key={layout.id}>
              <td>{layout.name}</td>
              <td>{layout.type}</td>
              <td>{layout.version}</td>
              <td>{impact[layout.id] ?? '...'}</td>
              <td>{new Date(layout.updatedAt).toLocaleString()}</td>
              <td>
                <div className="action-row">
                  <button className="secondary-button" onClick={() => beginEdit(layout)} disabled={isSaving}>
                    Edit visually
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LayoutPreviewPanelProps = {
  previewState: 'idle' | 'refreshing' | 'stale';
  previewError: string | null;
  preview: PreviewResult | null;
  refresh: () => Promise<void>;
};

function LayoutPreviewPanel({ previewState, previewError, preview, refresh }: Readonly<LayoutPreviewPanelProps>) {
  return (
    <section className="preview-panel">
      <h3>
        Layout preview
        {previewState === 'refreshing' ? ' (refreshing...)' : null}
        {previewState === 'stale' ? ' (stale)' : null}
      </h3>
      <div className="action-row" style={{ marginBottom: 10 }}>
        <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={previewState === 'refreshing'}>
          {previewState === 'refreshing' ? 'Refreshing...' : 'Refresh preview'}
        </button>
      </div>
      {previewError ? <p className="form-error">{previewError}</p> : null}
      {preview?.errors.length ? (
        <ul>
          {preview.errors.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ul>
      ) : null}
      {preview ? <iframe title="Layout preview" srcDoc={preview.html} className="preview-frame" /> : null}
    </section>
  );
}

function useLayoutsPageModel(router: ReturnType<typeof useRouter>) {
  const [layouts, setLayouts] = useState<LayoutItem[]>([]);
  const [impact, setImpact] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [type, setType] = useState<'HEADER' | 'FOOTER'>('HEADER');
  const [model, setModel] = useState<LayoutVisualModel>(defaultLayoutModel('HEADER'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingType, setEditingType] = useState<'HEADER' | 'FOOTER'>('HEADER');
  const [editingModel, setEditingModel] = useState<LayoutVisualModel>(defaultLayoutModel('HEADER'));
  const [createUndoStack, setCreateUndoStack] = useState<LayoutVisualModel[]>([]);
  const [createRedoStack, setCreateRedoStack] = useState<LayoutVisualModel[]>([]);
  const [editUndoStack, setEditUndoStack] = useState<LayoutVisualModel[]>([]);
  const [editRedoStack, setEditRedoStack] = useState<LayoutVisualModel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'refreshing' | 'stale'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);

  function updateCreateModel(next: React.SetStateAction<LayoutVisualModel>, trackHistory = true) {
    setModel((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      if (trackHistory) {
        setCreateUndoStack((stack) => [...stack, cloneLayoutModel(current)].slice(-HISTORY_LIMIT));
        setCreateRedoStack([]);
      }

      return cloneLayoutModel(resolved);
    });
  }

  function updateEditingModel(next: React.SetStateAction<LayoutVisualModel>, trackHistory = true) {
    setEditingModel((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      if (trackHistory) {
        setEditUndoStack((stack) => [...stack, cloneLayoutModel(current)].slice(-HISTORY_LIMIT));
        setEditRedoStack([]);
      }

      return cloneLayoutModel(resolved);
    });
  }

  function handleSessionExpired() {
    router.push('/login');
    router.refresh();
  }

  function beginEdit(layout: LayoutItem) {
    setEditingId(layout.id);
    setEditingName(layout.name);
    setEditingType(layout.type);
    setEditUndoStack([]);
    setEditRedoStack([]);
    if (layout.layoutModel?.blocks?.length) {
      updateEditingModel(layout.layoutModel, false);
      setSuccess('Loaded persisted visual layout model.');
      return;
    }

    updateEditingModel(inferLayoutModelFromMjml(layout.type, layout.mjml), false);
    setSuccess('Inferred visual layout model from legacy MJML. Save to persist and refine.');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
    setEditingType('HEADER');
    updateEditingModel(defaultLayoutModel('HEADER'), false);
    setEditUndoStack([]);
    setEditRedoStack([]);
  }

  function onCreateTypeChange(nextType: 'HEADER' | 'FOOTER') {
    setType(nextType);
    updateCreateModel(defaultLayoutModel(nextType), false);
    setCreateUndoStack([]);
    setCreateRedoStack([]);
  }

  function onEditingTypeChange(nextType: 'HEADER' | 'FOOTER') {
    setEditingType(nextType);
    updateEditingModel(defaultLayoutModel(nextType), false);
    setEditUndoStack([]);
    setEditRedoStack([]);
  }

  async function loadLayouts() {
    try {
      const data = await fetchAdminJson<LayoutItem[]>('/api/bff/layouts');
      setLayouts(data);

      const impactCounts: Record<string, number> = {};
      await Promise.all(
        data.map(async (item) => {
          try {
            const impactPayload = await fetchAdminJson<LayoutImpact>(`/api/bff/layouts/${item.id}/impact`);
            impactCounts[item.id] = impactPayload.affectedCount;
          } catch (impactError) {
            if (impactError instanceof SessionExpiredError) {
              throw impactError;
            }

            impactCounts[item.id] = 0;
          }
        }),
      );

      setImpact(impactCounts);
    } catch (loadError) {
      if (loadError instanceof SessionExpiredError) {
        handleSessionExpired();
        return;
      }

      setError('Could not load layouts.');
    }
  }

  useEffect(() => {
    void loadLayouts();
  }, [router]);

  async function refreshPreview(previewType: 'HEADER' | 'FOOTER', previewModel: LayoutVisualModel) {
    const validation = validateLayoutModel(previewModel);
    if (validation.summary.length > 0) {
      setPreviewState('stale');
      setPreviewError('Fix layout validation issues before refreshing preview.');
      return;
    }

    const mjml = renderLayoutModelToMjmlClient(previewModel, previewType.toLowerCase() as 'header' | 'footer');

    setPreviewState('refreshing');
    setPreviewError(null);

    try {
      const result = await fetchAdminJson<PreviewResult>('/api/bff/layouts/preview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          type: previewType.toLowerCase(),
          mjml,
          layoutModel: previewModel,
        }),
      });

      setPreview(result);
      setPreviewState('idle');
    } catch (requestError) {
      if (requestError instanceof SessionExpiredError) {
        handleSessionExpired();
        return;
      }

      setPreviewState('stale');
      setPreviewError(requestError instanceof Error ? requestError.message : 'Could not refresh preview.');
    }
  }

  useEffect(() => {
    const previewType = editingId ? editingType : type;
    const previewModel = editingId ? editingModel : model;

    const timeout = setTimeout(() => {
      void refreshPreview(previewType, previewModel);
    }, 900);

    return () => clearTimeout(timeout);
  }, [editingId, editingModel, editingType, model, type]);

  async function submitCreate(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validation = validateLayoutModel(model);
    if (validation.summary.length > 0) {
      setError('Fix layout validation issues before creating this layout.');
      return;
    }

    setIsSaving(true);

    try {
      await fetchAdminJson('/api/bff/layouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name,
          type: type.toLowerCase(),
          mjml: renderLayoutModelToMjmlClient(model, type.toLowerCase() as 'header' | 'footer'),
          layoutModel: model,
        }),
      });

      setSuccess('Layout created with visual model.');
      setName('');
      updateCreateModel(defaultLayoutModel(type), false);
      setCreateUndoStack([]);
      setCreateRedoStack([]);
      await loadLayouts();
    } catch (requestError) {
      if (requestError instanceof SessionExpiredError) {
        handleSessionExpired();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : 'Could not create layout.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit() {
    if (!editingId) {
      return;
    }

    setError(null);
    setSuccess(null);

    const validation = validateLayoutModel(editingModel);
    if (validation.summary.length > 0) {
      setError('Fix layout validation issues before saving this layout.');
      return;
    }

    setIsSaving(true);

    try {
      await fetchAdminJson(`/api/bff/layouts/${editingId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: editingName,
          type: editingType.toLowerCase(),
          mjml: renderLayoutModelToMjmlClient(editingModel, editingType.toLowerCase() as 'header' | 'footer'),
          layoutModel: editingModel,
        }),
      });

      setSuccess('Layout updated from visual model.');
      cancelEdit();
      await loadLayouts();
    } catch (requestError) {
      if (requestError instanceof SessionExpiredError) {
        handleSessionExpired();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : 'Could not update layout.');
    } finally {
      setIsSaving(false);
    }
  }

  const activeType = editingId ? editingType : type;
  const activeModel = editingId ? editingModel : model;
  const activeValidation = validateLayoutModel(activeModel);

  function updateActiveModel(next: LayoutVisualModel) {
    if (editingId) {
      updateEditingModel(next);
      return;
    }

    updateCreateModel(next);
  }

  const canUndo = editingId ? editUndoStack.length > 0 : createUndoStack.length > 0;
  const canRedo = editingId ? editRedoStack.length > 0 : createRedoStack.length > 0;

  function undoActiveModel() {
    if (editingId) {
      setEditUndoStack((stack) => {
        if (stack.length === 0) {
          return stack;
        }

        const previous = stack.at(-1);
        if (!previous) {
          return stack;
        }

        setEditRedoStack((redo) => [...redo, cloneLayoutModel(editingModel)].slice(-HISTORY_LIMIT));
        setEditingModel(cloneLayoutModel(previous));
        return stack.slice(0, -1);
      });
      return;
    }

    setCreateUndoStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }

      const previous = stack.at(-1);
      if (!previous) {
        return stack;
      }

      setCreateRedoStack((redo) => [...redo, cloneLayoutModel(model)].slice(-HISTORY_LIMIT));
      setModel(cloneLayoutModel(previous));
      return stack.slice(0, -1);
    });
  }

  function redoActiveModel() {
    if (editingId) {
      setEditRedoStack((stack) => {
        if (stack.length === 0) {
          return stack;
        }

        const next = stack.at(-1);
        if (!next) {
          return stack;
        }

        setEditUndoStack((undo) => [...undo, cloneLayoutModel(editingModel)].slice(-HISTORY_LIMIT));
        setEditingModel(cloneLayoutModel(next));
        return stack.slice(0, -1);
      });
      return;
    }

    setCreateRedoStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }

      const next = stack.at(-1);
      if (!next) {
        return stack;
      }

      setCreateUndoStack((undo) => [...undo, cloneLayoutModel(model)].slice(-HISTORY_LIMIT));
      setModel(cloneLayoutModel(next));
      return stack.slice(0, -1);
    });
  }

  return {
    layouts,
    impact,
    name,
    setName,
    type,
    onCreateTypeChange,
    model,
    setModel: updateCreateModel,
    editingId,
    editingName,
    setEditingName,
    editingType,
    onEditingTypeChange,
    setEditingModel: updateEditingModel,
    isSaving,
    error,
    success,
    preview,
    previewState,
    previewError,
    beginEdit,
    cancelEdit,
    submitCreate,
    saveEdit,
    activeType,
    activeModel,
    updateActiveModel,
    refreshPreview,
    canUndo,
    canRedo,
    undoActiveModel,
    redoActiveModel,
    activeValidationSummary: activeValidation.summary,
    activeValidationByBlockId: activeValidation.byBlockId,
  };
}

export default function LayoutsPage() {
  const router = useRouter();
  const {
    layouts,
    impact,
    name,
    setName,
    type,
    onCreateTypeChange,
    model,
    setModel,
    editingId,
    editingName,
    setEditingName,
    editingType,
    onEditingTypeChange,
    isSaving,
    error,
    success,
    preview,
    previewState,
    previewError,
    beginEdit,
    cancelEdit,
    submitCreate,
    saveEdit,
    activeType,
    activeModel,
    updateActiveModel,
    refreshPreview,
    canUndo,
    canRedo,
    undoActiveModel,
    redoActiveModel,
    activeValidationSummary,
    activeValidationByBlockId,
  } = useLayoutsPageModel(router);

  return (
    <main>
      <h2>Layouts</h2>
      <p className="admin-intro">Visual layout editor for reusable header and footer structures.</p>

      <CreateLayoutForm
        name={name}
        setName={setName}
        type={type}
        onTypeChange={onCreateTypeChange}
        model={model}
        setModel={setModel}
        isSaving={isSaving}
        submitCreate={submitCreate}
      />

      <EditLayoutSection
        editingId={editingId}
        editingName={editingName}
        setEditingName={setEditingName}
        editingType={editingType}
        onEditingTypeChange={onEditingTypeChange}
        isSaving={isSaving}
        saveEdit={saveEdit}
        cancelEdit={cancelEdit}
      />

      <LayoutBlocksEditor
        activeType={activeType}
        activeModel={activeModel}
        updateActiveModel={updateActiveModel}
        canUndo={canUndo}
        canRedo={canRedo}
        undoActiveModel={undoActiveModel}
        redoActiveModel={redoActiveModel}
        validationSummary={activeValidationSummary}
        validationByBlockId={activeValidationByBlockId}
      />

      {success ? <p className="status-success">{success}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <LayoutsTable layouts={layouts} impact={impact} isSaving={isSaving} beginEdit={beginEdit} />

      <LayoutPreviewPanel
        previewState={previewState}
        previewError={previewError}
        preview={preview}
        refresh={() => refreshPreview(activeType, activeModel)}
      />
    </main>
  );
}
