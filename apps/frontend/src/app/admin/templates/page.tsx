'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminJson, SessionExpiredError } from '../../../lib/client-api';

type BlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer';

type BodyBlock = {
  id: string;
  type: BlockType;
  content?: string;
  imageUrl?: string;
  altText?: string;
  href?: string;
};

type Template = {
  id: string;
  name: string;
  slug: string;
  subject: string;
  bodyMjml: string;
  headerLayoutId: string;
  footerLayoutId: string;
  status: string;
  version: number;
  updatedAt: string;
  blocks?: BodyBlock[];
};

type Layout = {
  id: string;
  name: string;
  type: 'HEADER' | 'FOOTER' | 'header' | 'footer';
  mjml: string;
};

type MediaAsset = {
  id: string;
  filename: string;
  originalName: string;
};

type TemplateFormState = {
  name: string;
  slug: string;
  subject: string;
  headerLayoutId: string;
  footerLayoutId: string;
  blocks: BodyBlock[];
};

type PreviewResult = {
  html: string;
  text: string;
  errors: string[];
};

type ExportTemplateResult = {
  templateId: string;
  slug: string;
  version: number;
  exportedAt: string;
  filename: string;
  html: string;
};

type TemplateField = 'name' | 'slug' | 'subject' | 'headerLayoutId' | 'footerLayoutId' | 'blocks';
type TemplateFieldErrors = Partial<Record<TemplateField, string>>;
type BlockErrorMap = Record<string, string[]>;

type ValidationResult = {
  fieldErrors: TemplateFieldErrors;
  blockErrors: BlockErrorMap;
};

const emptyForm: TemplateFormState = {
  name: '',
  slug: '',
  subject: '',
  headerLayoutId: '',
  footerLayoutId: '',
  blocks: [],
};

const backendAssetBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_ASSET_BASE_URL || 'http://localhost:3100').replace(/\/$/, '');

function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

function createBlock(type: BlockType): BodyBlock {
  const id = `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  switch (type) {
    case 'text':
      return { id, type, content: 'New text block' };
    case 'image':
      return { id, type, imageUrl: '', altText: '' };
    case 'button':
      return { id, type, content: 'Button text', href: 'https://example.com' };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type };
    default:
      return { id, type: 'text', content: 'New text block' };
  }
}

function normalizeBlocks(blocks: BodyBlock[] | undefined): BodyBlock[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks.map((block) => ({
    ...block,
    id: block.id || `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  }));
}

function escapeMjmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderBlocksToMjmlClient(blocks: BodyBlock[]): string {
  if (blocks.length === 0) {
    return '<mj-section><mj-column><mj-text></mj-text></mj-column></mj-section>';
  }

  return blocks
    .map((block) => {
      switch (block.type) {
        case 'text':
          return `<mj-section><mj-column><mj-text>${escapeMjmlText(block.content || '')}</mj-text></mj-column></mj-section>`;
        case 'image':
          return `<mj-section><mj-column><mj-image src="${block.imageUrl || ''}" alt="${escapeMjmlText(block.altText || '')}" /></mj-column></mj-section>`;
        case 'button':
          return `<mj-section><mj-column><mj-button href="${block.href || '#'}" background-color="#640098" color="#ffffff">${escapeMjmlText(block.content || 'Open link')}</mj-button></mj-column></mj-section>`;
        case 'divider':
          return '<mj-section><mj-column><mj-divider border-color="#d1d5db" /></mj-column></mj-section>';
        case 'spacer':
          return '<mj-section><mj-column><mj-spacer height="24px" /></mj-column></mj-section>';
        default:
          return '';
      }
    })
    .join('');
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeLayoutType(type: Layout['type']): 'HEADER' | 'FOOTER' | undefined {
  const normalized = type.toUpperCase();
  if (normalized === 'HEADER' || normalized === 'FOOTER') {
    return normalized;
  }

  return undefined;
}

function validateSlug(slug: string, existingTemplates: Template[], currentTemplateId?: string): string | undefined {
  if (!slug) {
    return 'Slug is required.';
  }

  const isValidPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  if (isValidPattern) {
    const duplicate = existingTemplates.some(
      (template) => template.slug === slug && template.id !== currentTemplateId,
    );
    return duplicate ? 'Slug is already in use. Choose a unique slug.' : undefined;
  }

  return 'Slug must use lowercase letters, numbers, and hyphens only.';
}

function validateBlock(block: BodyBlock): string[] {
  const issues: string[] = [];

  if (block.type === 'text' && !block.content?.trim()) {
    issues.push('Text block content is required.');
  }

  if (block.type === 'image') {
    const imageUrl = block.imageUrl?.trim() || '';
    if (!imageUrl) {
      issues.push('Image URL is required.');
    } else if (!isValidHttpUrl(imageUrl)) {
      issues.push('Image URL must be a valid http/https URL.');
    }
  }

  if (block.type === 'button') {
    if (!block.content?.trim()) {
      issues.push('Button text is required.');
    }

    const href = block.href?.trim() || '';
    if (!href) {
      issues.push('Button URL is required.');
    } else if (!isValidHttpUrl(href)) {
      issues.push('Button URL must be a valid http/https URL.');
    }
  }

  return issues;
}

function validateTemplateForm(
  form: TemplateFormState,
  existingTemplates: Template[],
  currentTemplateId?: string,
): ValidationResult {
  const fieldErrors: TemplateFieldErrors = {};
  const blockErrors: BlockErrorMap = {};

  if (!form.name.trim()) {
    fieldErrors.name = 'Template name is required.';
  }

  const slugError = validateSlug(form.slug.trim(), existingTemplates, currentTemplateId);
  if (slugError) {
    fieldErrors.slug = slugError;
  }

  if (!form.subject.trim()) {
    fieldErrors.subject = 'Subject is required.';
  }

  if (!form.headerLayoutId) {
    fieldErrors.headerLayoutId = 'Header layout is required.';
  }

  if (!form.footerLayoutId) {
    fieldErrors.footerLayoutId = 'Footer layout is required.';
  }

  if (form.blocks.length === 0) {
    fieldErrors.blocks = 'Add at least one content block.';
  }

  for (const block of form.blocks) {
    const issues = validateBlock(block);
    if (issues.length > 0) {
      blockErrors[block.id] = issues;
    }
  }

  return { fieldErrors, blockErrors };
}

function toTemplateFormState(template: Template): TemplateFormState {
  return {
    name: template.name,
    slug: template.slug,
    subject: template.subject,
    headerLayoutId: template.headerLayoutId,
    footerLayoutId: template.footerLayoutId,
    blocks: normalizeBlocks(template.blocks),
  };
}

type EditorProps = {
  value: TemplateFormState;
  onChange: (next: TemplateFormState) => void;
  mediaAssets: MediaAsset[];
  onUpload: (file: File) => Promise<void>;
  disabled: boolean;
  blockErrors?: BlockErrorMap;
  formError?: string;
};

function getMediaAssetUrl(filename: string): string {
  return `${backendAssetBaseUrl}/storage/uploads/${filename}`;
}

function BlocksEditor({ value, onChange, mediaAssets, onUpload, disabled, blockErrors, formError }: Readonly<EditorProps>) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateBlocks(nextBlocks: BodyBlock[]) {
    onChange({
      ...value,
      blocks: nextBlocks,
    });
  }

  function updateBlock(id: string, patch: Partial<BodyBlock>) {
    updateBlocks(
      value.blocks.map((block) => {
        if (block.id !== id) {
          return block;
        }

        return {
          ...block,
          ...patch,
        };
      }),
    );
  }

  function addBlock(type: BlockType) {
    updateBlocks([...value.blocks, createBlock(type)]);
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    const index = value.blocks.findIndex((item) => item.id === blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= value.blocks.length) {
      return;
    }

    const next = [...value.blocks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateBlocks(next);
  }

  function removeBlock(blockId: string) {
    updateBlocks(value.blocks.filter((item) => item.id !== blockId));
  }

  async function onUploadClick() {
    setUploadError(null);

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setUploadError('Select a file first.');
      return;
    }

    try {
      await onUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    }
  }

  return (
    <section className="editor-panel">
      <h4>Content blocks</h4>

      <div className="action-row" style={{ marginBottom: 10 }}>
        <button type="button" className="secondary-button" onClick={() => addBlock('text')} disabled={disabled}>
          + Text
        </button>
        <button type="button" className="secondary-button" onClick={() => addBlock('image')} disabled={disabled}>
          + Image
        </button>
        <button type="button" className="secondary-button" onClick={() => addBlock('button')} disabled={disabled}>
          + Button
        </button>
        <button type="button" className="secondary-button" onClick={() => addBlock('divider')} disabled={disabled}>
          + Divider
        </button>
        <button type="button" className="secondary-button" onClick={() => addBlock('spacer')} disabled={disabled}>
          + Spacer
        </button>
      </div>

      <div className="upload-form">
        <label htmlFor="editor-file">Upload image</label>
        <input ref={fileInputRef} id="editor-file" name="editor-file" type="file" accept="image/*" />
        <button type="button" className="secondary-button" disabled={disabled} onClick={() => void onUploadClick()}>
          Upload to library
        </button>
      </div>
      {uploadError ? <p className="form-error">{uploadError}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      {value.blocks.length === 0 ? <p className="admin-intro">Add blocks to compose your email body.</p> : null}

      {value.blocks.map((block, index) => (
        <div key={block.id} className="table-wrap" style={{ padding: 12, marginBottom: 10 }}>
          <div className="action-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>
              {index + 1}. {block.type}
            </strong>
            <div className="action-row">
              <button type="button" className="secondary-button" onClick={() => moveBlock(block.id, -1)} disabled={disabled || index === 0}>
                Up
              </button>
              <button type="button" className="secondary-button" onClick={() => moveBlock(block.id, 1)} disabled={disabled || index === value.blocks.length - 1}>
                Down
              </button>
              <button type="button" className="secondary-button" onClick={() => removeBlock(block.id)} disabled={disabled}>
                Remove
              </button>
            </div>
          </div>

          {block.type === 'text' ? (
            <textarea
              className="editor-textarea"
              rows={4}
              value={block.content || ''}
              onChange={(event) => updateBlock(block.id, { content: event.target.value })}
              disabled={disabled}
            />
          ) : null}

          {block.type === 'image' ? (
            <div className="auth-form" style={{ marginTop: 4 }}>
              <select
                value={block.imageUrl || ''}
                onChange={(event) => updateBlock(block.id, { imageUrl: event.target.value })}
                disabled={disabled}
              >
                <option value="">Select media from library</option>
                {mediaAssets.map((asset) => (
                  <option
                    key={asset.id}
                    value={getMediaAssetUrl(asset.filename)}
                  >
                    {asset.originalName}
                  </option>
                ))}
              </select>
              <input
                placeholder="Or paste image URL"
                value={block.imageUrl || ''}
                onChange={(event) => updateBlock(block.id, { imageUrl: event.target.value })}
                disabled={disabled}
              />
              <input
                placeholder="Alt text"
                value={block.altText || ''}
                onChange={(event) => updateBlock(block.id, { altText: event.target.value })}
                disabled={disabled}
              />
            </div>
          ) : null}

          {block.type === 'button' ? (
            <div className="auth-form" style={{ marginTop: 4 }}>
              <input
                placeholder="Button text"
                value={block.content || ''}
                onChange={(event) => updateBlock(block.id, { content: event.target.value })}
                disabled={disabled}
              />
              <input
                placeholder="Button URL"
                value={block.href || ''}
                onChange={(event) => updateBlock(block.id, { href: event.target.value })}
                disabled={disabled}
              />
            </div>
          ) : null}

          {(blockErrors?.[block.id] || []).map((entry) => (
            <p key={`${block.id}-${entry}`} className="form-error" style={{ marginTop: 6 }}>
              {entry}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}

type CreateTemplateDraftFormProps = {
  createForm: TemplateFormState;
  setCreateForm: React.Dispatch<React.SetStateAction<TemplateFormState>>;
  headerLayouts: Layout[];
  footerLayouts: Layout[];
  createValidationVisible: boolean;
  createValidation: ValidationResult;
  mediaAssets: MediaAsset[];
  uploadMediaAsset: (file: File) => Promise<void>;
  isSaving: boolean;
  submitCreate: (event: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
};

function CreateTemplateDraftForm({
  createForm,
  setCreateForm,
  headerLayouts,
  footerLayouts,
  createValidationVisible,
  createValidation,
  mediaAssets,
  uploadMediaAsset,
  isSaving,
  submitCreate,
}: Readonly<CreateTemplateDraftFormProps>) {
  return (
    <form className="auth-form" onSubmit={submitCreate}>
      <strong>Create template (draft)</strong>
      <input
        placeholder="Template name"
        value={createForm.name}
        onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
        required
      />
      {createValidationVisible && createValidation.fieldErrors.name ? <p className="form-error">{createValidation.fieldErrors.name}</p> : null}
      <input
        placeholder="slug"
        value={createForm.slug}
        onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))}
        required
      />
      {createValidationVisible && createValidation.fieldErrors.slug ? <p className="form-error">{createValidation.fieldErrors.slug}</p> : null}
      <input
        placeholder="Subject"
        value={createForm.subject}
        onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))}
        required
      />
      {createValidationVisible && createValidation.fieldErrors.subject ? <p className="form-error">{createValidation.fieldErrors.subject}</p> : null}
      <select
        value={createForm.headerLayoutId}
        onChange={(event) => setCreateForm((current) => ({ ...current, headerLayoutId: event.target.value }))}
        required
      >
        <option value="">Select header layout</option>
        {headerLayouts.length === 0 ? <option value="" disabled>No header layouts available</option> : null}
        {headerLayouts.map((layout) => (
          <option key={layout.id} value={layout.id}>
            {layout.name}
          </option>
        ))}
      </select>
      {createValidationVisible && createValidation.fieldErrors.headerLayoutId ? <p className="form-error">{createValidation.fieldErrors.headerLayoutId}</p> : null}
      <select
        value={createForm.footerLayoutId}
        onChange={(event) => setCreateForm((current) => ({ ...current, footerLayoutId: event.target.value }))}
        required
      >
        <option value="">Select footer layout</option>
        {footerLayouts.length === 0 ? <option value="" disabled>No footer layouts available</option> : null}
        {footerLayouts.map((layout) => (
          <option key={layout.id} value={layout.id}>
            {layout.name}
          </option>
        ))}
      </select>
      {createValidationVisible && createValidation.fieldErrors.footerLayoutId ? <p className="form-error">{createValidation.fieldErrors.footerLayoutId}</p> : null}

      <BlocksEditor
        value={createForm}
        onChange={setCreateForm}
        mediaAssets={mediaAssets}
        onUpload={uploadMediaAsset}
        disabled={isSaving}
        blockErrors={createValidationVisible ? createValidation.blockErrors : undefined}
        formError={createValidationVisible ? createValidation.fieldErrors.blocks : undefined}
      />

      <button className="primary-button" type="submit" disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Draft'}
      </button>
    </form>
  );
}

type EditTemplateDraftSectionProps = {
  editingId: string | null;
  editingForm: TemplateFormState | null;
  setEditingForm: React.Dispatch<React.SetStateAction<TemplateFormState | null>>;
  headerLayouts: Layout[];
  footerLayouts: Layout[];
  editValidationVisible: boolean;
  editValidation: ValidationResult | null;
  mediaAssets: MediaAsset[];
  uploadMediaAsset: (file: File) => Promise<void>;
  isSaving: boolean;
  saveEditing: (templateId: string) => Promise<void>;
  cancelEditing: () => void;
};

function EditTemplateDraftSection({
  editingId,
  editingForm,
  setEditingForm,
  headerLayouts,
  footerLayouts,
  editValidationVisible,
  editValidation,
  mediaAssets,
  uploadMediaAsset,
  isSaving,
  saveEditing,
  cancelEditing,
}: Readonly<EditTemplateDraftSectionProps>) {
  if (!editingForm || !editingId) {
    return null;
  }

  const editFieldErrors = editValidationVisible ? editValidation?.fieldErrors : undefined;
  const editBlockErrors = editValidationVisible ? editValidation?.blockErrors : undefined;

  return (
    <section className="editor-panel">
      <h3>Edit draft: {editingForm.name}</h3>
      <div className="auth-form">
        <input
          placeholder="Template name"
          value={editingForm.name}
          onChange={(event) => setEditingForm((current) => (current ? { ...current, name: event.target.value } : current))}
        />
        {editFieldErrors?.name ? <p className="form-error">{editFieldErrors.name}</p> : null}
        <input
          placeholder="slug"
          value={editingForm.slug}
          onChange={(event) => setEditingForm((current) => (current ? { ...current, slug: event.target.value } : current))}
        />
        {editFieldErrors?.slug ? <p className="form-error">{editFieldErrors.slug}</p> : null}
        <input
          placeholder="Subject"
          value={editingForm.subject}
          onChange={(event) => setEditingForm((current) => (current ? { ...current, subject: event.target.value } : current))}
        />
        {editFieldErrors?.subject ? <p className="form-error">{editFieldErrors.subject}</p> : null}
        <select
          value={editingForm.headerLayoutId}
          onChange={(event) => setEditingForm((current) => (current ? { ...current, headerLayoutId: event.target.value } : current))}
        >
          <option value="">Select header layout</option>
          {headerLayouts.length === 0 ? <option value="" disabled>No header layouts available</option> : null}
          {headerLayouts.map((layout) => (
            <option key={layout.id} value={layout.id}>
              {layout.name}
            </option>
          ))}
        </select>
        {editFieldErrors?.headerLayoutId ? <p className="form-error">{editFieldErrors.headerLayoutId}</p> : null}
        <select
          value={editingForm.footerLayoutId}
          onChange={(event) => setEditingForm((current) => (current ? { ...current, footerLayoutId: event.target.value } : current))}
        >
          <option value="">Select footer layout</option>
          {footerLayouts.length === 0 ? <option value="" disabled>No footer layouts available</option> : null}
          {footerLayouts.map((layout) => (
            <option key={layout.id} value={layout.id}>
              {layout.name}
            </option>
          ))}
        </select>
        {editFieldErrors?.footerLayoutId ? <p className="form-error">{editFieldErrors.footerLayoutId}</p> : null}
      </div>

      <BlocksEditor
        value={editingForm}
        onChange={(next) => setEditingForm(next)}
        mediaAssets={mediaAssets}
        onUpload={uploadMediaAsset}
        disabled={isSaving}
        blockErrors={editBlockErrors}
        formError={editFieldErrors?.blocks}
      />

      <div className="action-row" style={{ marginTop: 10 }}>
        <button className="primary-button" onClick={() => void saveEditing(editingId)} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Draft'}
        </button>
        <button className="secondary-button" onClick={cancelEditing} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </section>
  );
}

type TemplatesTableProps = {
  templates: Template[];
  isSaving: boolean;
  startEditing: (template: Template) => void;
  exportTemplate: (templateId: string) => Promise<void>;
  publishTemplate: (templateId: string) => Promise<void>;
  rollbackTemplate: (templateId: string) => Promise<void>;
  rollbackVersions: Record<string, string>;
  setRollbackVersions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

function TemplatesTable({
  templates,
  isSaving,
  startEditing,
  exportTemplate,
  publishTemplate,
  rollbackTemplate,
  rollbackVersions,
  setRollbackVersions,
}: Readonly<TemplatesTableProps>) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Version</th>
            <th>Subject</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id}>
              <td>{template.name}</td>
              <td>{template.slug}</td>
              <td>{template.status}</td>
              <td>{template.version}</td>
              <td>{template.subject}</td>
              <td>{new Date(template.updatedAt).toLocaleString()}</td>
              <td>
                <div className="action-row">
                  <button className="secondary-button" onClick={() => startEditing(template)} disabled={isSaving}>
                    Edit Draft
                  </button>
                  <button className="secondary-button" onClick={() => void exportTemplate(template.id)} disabled={isSaving}>
                    Export HTML
                  </button>
                  <button className="secondary-button" onClick={() => void publishTemplate(template.id)} disabled={isSaving}>
                    Publish
                  </button>
                  <button className="secondary-button" onClick={() => void rollbackTemplate(template.id)} disabled={isSaving}>
                    Rollback
                  </button>
                  <input
                    className="inline-number-input"
                    type="number"
                    min={1}
                    value={rollbackVersions[template.id] || '1'}
                    onChange={(event) =>
                      setRollbackVersions((current) => ({
                        ...current,
                        [template.id]: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TemplatePreviewPanelProps = {
  preview: PreviewResult | null;
  previewTemplateName: string;
  previewState: 'idle' | 'refreshing' | 'stale';
  previewError: string | null;
  refreshPreview: () => Promise<void>;
};

function TemplatePreviewPanel({
  preview,
  previewTemplateName,
  previewState,
  previewError,
  refreshPreview,
}: Readonly<TemplatePreviewPanelProps>) {
  if (!preview) {
    return null;
  }

  return (
    <section className="preview-panel">
      <h3>
        Live preview: {previewTemplateName}
        {previewState === 'refreshing' ? ' (refreshing...)' : null}
        {previewState === 'stale' ? ' (stale)' : null}
      </h3>
      <div className="action-row" style={{ marginBottom: 10 }}>
        <button className="secondary-button" type="button" onClick={() => void refreshPreview()} disabled={previewState === 'refreshing'}>
          {previewState === 'refreshing' ? 'Refreshing...' : 'Refresh preview'}
        </button>
      </div>
      {previewError ? <p className="form-error">{previewError}</p> : null}
      {preview.errors.length > 0 ? (
        <ul>
          {preview.errors.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ul>
      ) : null}
      <iframe title="Template preview" srcDoc={preview.html} className="preview-frame" />
    </section>
  );
}

function useTemplatesPageModel(router: ReturnType<typeof useRouter>) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [rollbackVersions, setRollbackVersions] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState<TemplateFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<TemplateFormState | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewTemplateName, setPreviewTemplateName] = useState<string>('');
  const [previewState, setPreviewState] = useState<'idle' | 'refreshing' | 'stale'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createValidationVisible, setCreateValidationVisible] = useState(false);
  const [editValidationVisible, setEditValidationVisible] = useState(false);

  const headerLayouts = useMemo(
    () => layouts.filter((layout) => layout.type === 'HEADER'),
    [layouts],
  );
  const footerLayouts = useMemo(
    () => layouts.filter((layout) => layout.type === 'FOOTER'),
    [layouts],
  );

  const activeForm = editingForm || createForm;

  const createValidation = useMemo(
    () => validateTemplateForm(createForm, templates),
    [createForm, templates],
  );
  const editValidation = useMemo(
    () => (editingForm && editingId ? validateTemplateForm(editingForm, templates, editingId) : null),
    [editingForm, editingId, templates],
  );

  function handleSessionExpired() {
    router.push('/login');
    router.refresh();
  }

  async function loadData() {
    try {
      const [templateData, layoutData, mediaData] = await Promise.all([
        fetchAdminJson<Template[]>('/api/bff/templates'),
        fetchAdminJson<Layout[]>('/api/bff/layouts'),
        fetchAdminJson<MediaAsset[]>('/api/bff/media'),
      ]);

      const normalizedLayouts = layoutData
        .map((layout) => {
          const normalizedType = normalizeLayoutType(layout.type);
          if (!normalizedType) {
            return undefined;
          }

          return {
            ...layout,
            type: normalizedType,
          };
        })
        .filter((layout): layout is Layout & { type: 'HEADER' | 'FOOTER' } => Boolean(layout));

      setTemplates(templateData.map((template) => ({ ...template, blocks: normalizeBlocks(template.blocks) })));
      setLayouts(normalizedLayouts);
      setMediaAssets(mediaData);
      setRollbackVersions((current) => {
        const next = { ...current };
        for (const template of templateData) {
          if (!next[template.id]) {
            next[template.id] = String(template.version || 1);
          }
        }
        return next;
      });

      const defaultHeader = normalizedLayouts.find((item) => item.type === 'HEADER')?.id || '';
      const defaultFooter = normalizedLayouts.find((item) => item.type === 'FOOTER')?.id || '';

      setCreateForm((current) => ({
        ...current,
        headerLayoutId: current.headerLayoutId || defaultHeader,
        footerLayoutId: current.footerLayoutId || defaultFooter,
      }));
    } catch (loadError) {
      if (isSessionExpiredError(loadError)) {
        handleSessionExpired();
        return;
      }

      setError('Could not load templates.');
    }
  }

  useEffect(() => {
    void loadData();
  }, [router]);

  const refreshPreview = useCallback(async () => {
    const headerMjml = layouts.find((layout) => layout.id === activeForm.headerLayoutId)?.mjml;
    const footerMjml = layouts.find((layout) => layout.id === activeForm.footerLayoutId)?.mjml;

    if (!headerMjml || !footerMjml) {
      setPreviewState('stale');
      setPreviewError('Select both a header and footer layout to generate preview.');
      return;
    }

    setPreviewState('refreshing');
    setPreviewError(null);

    try {
      const result = await fetchAdminJson<PreviewResult>('/api/bff/templates/preview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          headerMjml,
          bodyMjml: renderBlocksToMjmlClient(activeForm.blocks),
          footerMjml,
        }),
      });

      setPreview(result);
      setPreviewTemplateName(activeForm.name || (editingId ? 'Editing template' : 'New template draft'));
      setPreviewState('idle');
    } catch (requestError) {
      if (isSessionExpiredError(requestError)) {
        handleSessionExpired();
        return;
      }

      setPreviewState('stale');
      setPreviewError(requestError instanceof Error ? requestError.message : 'Could not refresh preview.');
    }
  }, [activeForm, editingId, layouts, router]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refreshPreview();
    }, 1200);

    return () => clearTimeout(timeout);
  }, [refreshPreview]);

  async function uploadMediaAsset(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/bff/media/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      try {
        const payload = (await response.json()) as { code?: string };
        if (response.status === 401 && (payload.code === 'session_expired' || payload.code === 'reauth_required')) {
          handleSessionExpired();
          return;
        }
      } catch {
        // fallback to generic error
      }
      throw new Error('Media upload failed.');
    }

    setSuccess('Media uploaded to library.');
    await loadData();
  }

  async function submitCreate(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateValidationVisible(true);

    if (Object.keys(createValidation.fieldErrors).length > 0 || Object.keys(createValidation.blockErrors).length > 0) {
      setError('Please fix validation issues before saving draft.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await fetchAdminJson<Template>('/api/bff/templates', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...createForm,
          blocks: createForm.blocks,
        }),
      });

      setSuccess('Template draft saved.');
      setCreateForm((current) => ({
        ...emptyForm,
        headerLayoutId: current.headerLayoutId,
        footerLayoutId: current.footerLayoutId,
      }));
      setCreateValidationVisible(false);
      await loadData();
    } catch (requestError) {
      if (isSessionExpiredError(requestError)) {
        handleSessionExpired();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : 'Could not create template.');
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(template: Template) {
    setError(null);
    setSuccess(null);
    setEditValidationVisible(false);
    setEditingId(template.id);
    setEditingForm(toTemplateFormState(template));
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingForm(null);
    setEditValidationVisible(false);
  }

  async function saveEditing(templateId: string) {
    if (!editingForm) {
      return;
    }

    setEditValidationVisible(true);

    if (
      editValidation &&
      (Object.keys(editValidation.fieldErrors).length > 0 || Object.keys(editValidation.blockErrors).length > 0)
    ) {
      setError('Please fix validation issues before saving draft.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const updatedTemplate = await fetchAdminJson<Template>(`/api/bff/templates/${templateId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...editingForm,
          blocks: editingForm.blocks,
        }),
      });

      const hydratedTemplate = {
        ...updatedTemplate,
        blocks: normalizeBlocks(updatedTemplate.blocks),
      };

      setTemplates((current) => {
        const exists = current.some((template) => template.id === hydratedTemplate.id);
        const next = exists
          ? current.map((template) => (template.id === hydratedTemplate.id ? hydratedTemplate : template))
          : [hydratedTemplate, ...current];

        return [...next].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });

      setEditingId(hydratedTemplate.id);
      setEditingForm(toTemplateFormState(hydratedTemplate));
      setEditValidationVisible(false);
      setSuccess('Template draft updated. Changes are now reflected below.');

      await refreshPreview();
    } catch (requestError) {
      if (isSessionExpiredError(requestError)) {
        handleSessionExpired();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : 'Could not update template.');
    } finally {
      setIsSaving(false);
    }
  }

  async function publishTemplate(templateId: string) {
    const confirmed = globalThis.confirm('Publish this template and snapshot a new version?');
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await fetchAdminJson(`/api/bff/templates/${templateId}/publish`, {
        method: 'POST',
      });
      setSuccess('Template published.');
      await loadData();
    } catch (requestError) {
      if (isSessionExpiredError(requestError)) {
        handleSessionExpired();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : 'Could not publish template.');
    } finally {
      setIsSaving(false);
    }
  }

  async function exportTemplate(templateId: string) {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const payload = await fetchAdminJson<ExportTemplateResult>(`/api/bff/templates/${templateId}/export-html`);
      const blob = new Blob([payload.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = payload.filename || `${payload.slug}-v${payload.version}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setSuccess(`Exported ${link.download}.`);
    } catch (requestError) {
      if (isSessionExpiredError(requestError)) {
        handleSessionExpired();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : 'Could not export template HTML.');
    } finally {
      setIsSaving(false);
    }
  }

  async function rollbackTemplate(templateId: string) {
    const version = Number(rollbackVersions[templateId]);
    if (!Number.isInteger(version) || version < 1) {
      setError('Rollback version must be a positive integer.');
      return;
    }

    const confirmed = globalThis.confirm(`Roll back this template to version ${version}?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await fetchAdminJson(`/api/bff/templates/${templateId}/rollback/${version}`, {
        method: 'POST',
      });
      setSuccess(`Template rolled back to version ${version}.`);
      await loadData();
    } catch (requestError) {
      if (isSessionExpiredError(requestError)) {
        handleSessionExpired();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : 'Could not roll back template.');
    } finally {
      setIsSaving(false);
    }
  }

  return {
    templates,
    layouts,
    mediaAssets,
    rollbackVersions,
    setRollbackVersions,
    createForm,
    setCreateForm,
    editingId,
    editingForm,
    setEditingForm,
    preview,
    previewTemplateName,
    previewState,
    previewError,
    error,
    success,
    isSaving,
    createValidationVisible,
    editValidationVisible,
    headerLayouts,
    footerLayouts,
    createValidation,
    editValidation,
    refreshPreview,
    submitCreate,
    startEditing,
    cancelEditing,
    saveEditing,
    exportTemplate,
    publishTemplate,
    rollbackTemplate,
    uploadMediaAsset,
  };
}

export default function TemplatesPage() {
  const router = useRouter();
  const {
    templates,
    mediaAssets,
    rollbackVersions,
    setRollbackVersions,
    createForm,
    setCreateForm,
    editingId,
    editingForm,
    setEditingForm,
    preview,
    previewTemplateName,
    previewState,
    previewError,
    error,
    success,
    isSaving,
    createValidationVisible,
    editValidationVisible,
    headerLayouts,
    footerLayouts,
    createValidation,
    editValidation,
    refreshPreview,
    submitCreate,
    startEditing,
    cancelEditing,
    saveEditing,
    exportTemplate,
    publishTemplate,
    rollbackTemplate,
    uploadMediaAsset,
  } = useTemplatesPageModel(router);

  return (
    <main>
      <h2>Templates</h2>
      <p className="admin-intro">Block-based template editor for non-technical content staff.</p>

      <CreateTemplateDraftForm
        createForm={createForm}
        setCreateForm={setCreateForm}
        headerLayouts={headerLayouts}
        footerLayouts={footerLayouts}
        createValidationVisible={createValidationVisible}
        createValidation={createValidation}
        mediaAssets={mediaAssets}
        uploadMediaAsset={uploadMediaAsset}
        isSaving={isSaving}
        submitCreate={submitCreate}
      />

      <EditTemplateDraftSection
        editingId={editingId}
        editingForm={editingForm}
        setEditingForm={setEditingForm}
        headerLayouts={headerLayouts}
        footerLayouts={footerLayouts}
        editValidationVisible={editValidationVisible}
        editValidation={editValidation}
        mediaAssets={mediaAssets}
        uploadMediaAsset={uploadMediaAsset}
        isSaving={isSaving}
        saveEditing={saveEditing}
        cancelEditing={cancelEditing}
      />

      {success ? <p className="status-success">{success}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <TemplatesTable
        templates={templates}
        isSaving={isSaving}
        startEditing={startEditing}
        exportTemplate={exportTemplate}
        publishTemplate={publishTemplate}
        rollbackTemplate={rollbackTemplate}
        rollbackVersions={rollbackVersions}
        setRollbackVersions={setRollbackVersions}
      />

      <TemplatePreviewPanel
        preview={preview}
        previewTemplateName={previewTemplateName}
        previewState={previewState}
        previewError={previewError}
        refreshPreview={refreshPreview}
      />
    </main>
  );
}
