import { forwardMultipart } from '../../../../../lib/bff';

export async function POST(request: Request) {
  return forwardMultipart('/api/media/upload', request);
}
