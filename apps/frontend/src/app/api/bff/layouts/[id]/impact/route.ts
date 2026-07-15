import { forwardToBackend } from '../../../../../../lib/bff';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forwardToBackend(`/api/layouts/${id}/impact`, request, {
    method: 'GET',
  });
}
