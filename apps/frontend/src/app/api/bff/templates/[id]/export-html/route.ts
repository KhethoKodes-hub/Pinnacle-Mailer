import { forwardToBackend } from '../../../../../../lib/bff';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return forwardToBackend(`/api/templates/${id}/export-html`, request, {
    method: 'GET',
  });
}
