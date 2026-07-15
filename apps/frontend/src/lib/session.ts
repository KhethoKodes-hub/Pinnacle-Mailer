import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';

export async function getAuthSession() {
  return getServerSession(authOptions);
}
