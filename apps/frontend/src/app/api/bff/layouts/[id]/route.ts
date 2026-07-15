import { forwardJson } from '../../../../../lib/bff';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forwardJson(`/api/layouts/${id}`, request);
}
