import { PreviewRequest, PreviewResult } from '@pinnacle-mailer/shared-types';

type MjmlToHtml = (
  input: string,
  options?: { minify?: boolean; validationLevel?: 'strict' | 'soft' | 'skip' },
) =>
  | { html?: string; errors?: Array<{ formattedMessage?: string; message: string }> }
  | Promise<{ html?: string; errors?: Array<{ formattedMessage?: string; message: string }> }>;

const mjmlModule = require('mjml') as MjmlToHtml | { default?: MjmlToHtml };
let mjml2html: MjmlToHtml;
if (typeof mjmlModule === 'function') {
  mjml2html = mjmlModule;
} else if (typeof mjmlModule.default === 'function') {
  mjml2html = mjmlModule.default;
} else {
  mjml2html = () => ({ html: '', errors: [{ message: 'MJML renderer is unavailable.' }] });
}

export function composeMjml(request: PreviewRequest): string {
  return `<mjml><mj-body>${request.headerMjml}${request.bodyMjml}${request.footerMjml}</mj-body></mjml>`;
}

export async function renderPreview(request: PreviewRequest): Promise<PreviewResult> {
  const mjml = composeMjml(request);
  const result = await mjml2html(mjml, {
    minify: true,
    validationLevel: 'soft',
  });
  const html = typeof result.html === 'string' ? result.html : '';
  const errors = Array.isArray(result.errors) ? result.errors : [];

  return {
    html,
    text: stripHtml(html),
    errors: errors.map(
      (entry: { formattedMessage?: string; message: string }) =>
        entry.formattedMessage || entry.message,
    ),
  };
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
