import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';

export async function getAuthSession() {
  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}
