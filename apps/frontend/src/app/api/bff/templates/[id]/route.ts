import { forwardJson } from '../../../../../lib/bff';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return forwardJson(`/api/templates/${id}`, request);
}
