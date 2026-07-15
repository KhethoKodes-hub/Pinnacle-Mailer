import { forwardJson } from '../../../../../lib/bff';

export async function POST(request: Request) {
  return forwardJson('/api/templates/preview', request);
}
