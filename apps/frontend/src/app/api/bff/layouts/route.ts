import { forwardJson, forwardToBackend } from '../../../../lib/bff';

export async function GET(request: Request) {
  return forwardToBackend('/api/layouts', request, {
    method: 'GET',
  });
}

export async function POST(request: Request) {
  return forwardJson('/api/layouts', request);
}
