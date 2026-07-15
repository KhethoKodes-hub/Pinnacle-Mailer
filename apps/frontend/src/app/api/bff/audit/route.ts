import { forwardToBackend } from '../../../../lib/bff';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();

  const limit = url.searchParams.get('limit');
  const entity = url.searchParams.get('entity');
  const action = url.searchParams.get('action');
  const requestId = url.searchParams.get('requestId');

  if (limit) {
    params.set('limit', limit);
  }

  if (entity) {
    params.set('entity', entity);
  }

  if (action) {
    params.set('action', action);
  }

  if (requestId) {
    params.set('requestId', requestId);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';

  return forwardToBackend(`/api/audit${suffix}`, request, {
    method: 'GET',
  });
}
