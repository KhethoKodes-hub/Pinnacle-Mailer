import { forwardToBackend } from '../../../../../../lib/bff';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return forwardToBackend(`/api/templates/${id}/publish`, request, {
    method: 'POST',
  });
}
