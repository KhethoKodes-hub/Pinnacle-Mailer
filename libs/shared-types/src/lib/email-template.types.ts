export type TemplateStatus = 'draft' | 'published';

export type LayoutType = 'header' | 'footer';

export interface LayoutSnapshot {
  id: string;
  name: string;
  type: LayoutType;
  mjml: string;
  version: number;
}

export interface BodyBlock {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer';
  content?: string;
  imageUrl?: string;
  altText?: string;
  href?: string;
}

export interface EmailTemplateDraft {
  id: string;
  name: string;
  slug: string;
  subject: string;
  status: TemplateStatus;
  headerLayoutId: string;
  footerLayoutId: string;
  bodyMjml: string;
  blocks: BodyBlock[];
}

export interface PreviewRequest {
  headerMjml: string;
  bodyMjml: string;
  footerMjml: string;
}

export interface PreviewResult {
  html: string;
  text: string;
  errors: string[];
}

export type LayoutVisualBlockType = 'brand' | 'nav_links' | 'legal' | 'social' | 'divider' | 'spacer';

export interface LayoutVisualLink {
  id: string;
  label: string;
  href: string;
}

export interface LayoutVisualBlock {
  id: string;
  type: LayoutVisualBlockType;
  text?: string;
  logoUrl?: string;
  links?: LayoutVisualLink[];
}

export interface LayoutVisualModel {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  blocks: LayoutVisualBlock[];
}
