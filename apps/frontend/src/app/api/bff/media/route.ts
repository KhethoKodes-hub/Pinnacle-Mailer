import { forwardToBackend } from '../../../../lib/bff';

export async function GET(request: Request) {
  return forwardToBackend('/api/media', request, {
    method: 'GET',
  });
}
