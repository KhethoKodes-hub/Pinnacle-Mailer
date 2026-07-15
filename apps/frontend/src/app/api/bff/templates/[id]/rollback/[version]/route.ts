import { forwardToBackend } from '../../../../../../../lib/bff';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; version: string }> },
) {
  const { id, version } = await context.params;
  return forwardToBackend(`/api/templates/${id}/rollback/${version}`, request, {
    method: 'POST',
  });
}
