export interface AuthenticatedPrincipal {
  id: string;
  kind: 'user' | 'client';
  clientId?: string;
  scopes: string[];
  displayName?: string;
  email?: string;
}
