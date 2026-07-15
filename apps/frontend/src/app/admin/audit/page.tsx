'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminJson, SessionExpiredError } from '../../../lib/client-api';

type AuditEvent = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  actorClientId: string | null;
  requestId: string | null;
  createdAt: string;
};

const LIMIT_OPTIONS = [25, 50, 100, 200] as const;
const ENTITY_OPTIONS = ['all', 'template', 'layout', 'media', 'api_client', 'auth_session'] as const;
const ACTION_OPTIONS = [
  'all',
  'create',
  'update',
  'publish',
  'rollback',
  'delete',
  'revoke',
  'rotate_secret',
  'login',
  'refresh',
  'logout',
  'refresh_reuse',
] as const;

export default function AuditPage() {
  const router = useRouter();
  const [limit, setLimit] = useState<(typeof LIMIT_OPTIONS)[number]>(50);
  const [entity, setEntity] = useState<(typeof ENTITY_OPTIONS)[number]>('all');
  const [action, setAction] = useState<(typeof ACTION_OPTIONS)[number]>('all');
  const [requestId, setRequestId] = useState('');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));

    if (entity !== 'all') {
      params.set('entity', entity);
    }

    if (action !== 'all') {
      params.set('action', action);
    }

    const requestIdValue = requestId.trim();
    if (requestIdValue.length > 0) {
      params.set('requestId', requestIdValue);
    }

    return `/api/bff/audit?${params.toString()}`;
  }, [action, entity, limit, requestId]);

  useEffect(() => {
    async function loadAuditEvents() {
      setError(null);
      setIsLoading(true);

      try {
        const data = await fetchAdminJson<AuditEvent[]>(endpoint);
        setEvents(data);
      } catch (loadError) {
        if (loadError instanceof SessionExpiredError) {
          router.push('/login');
          router.refresh();
          return;
        }

        setError('Could not load audit events.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadAuditEvents();
  }, [endpoint, router]);

  return (
    <main>
      <h2>Audit</h2>
      <p className="admin-intro">Most recent mutation events from the backend audit stream.</p>

      <div className="audit-toolbar">
        <label htmlFor="audit-limit">Rows</label>
        <select
          id="audit-limit"
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value) as (typeof LIMIT_OPTIONS)[number])}
        >
          {LIMIT_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <label htmlFor="audit-entity">Entity</label>
        <select
          id="audit-entity"
          value={entity}
          onChange={(event) => setEntity(event.target.value as (typeof ENTITY_OPTIONS)[number])}
        >
          {ENTITY_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <label htmlFor="audit-action">Action</label>
        <select
          id="audit-action"
          value={action}
          onChange={(event) => setAction(event.target.value as (typeof ACTION_OPTIONS)[number])}
        >
          {ACTION_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <label htmlFor="audit-request-id">Request ID</label>
        <input
          id="audit-request-id"
          type="text"
          value={requestId}
          onChange={(event) => setRequestId(event.target.value)}
          placeholder="Search request ID"
        />
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p className="admin-intro">Loading audit events...</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Entity ID</th>
              <th>Actor</th>
              <th>Request ID</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
                <td>{event.entity}</td>
                <td>{event.action}</td>
                <td>{event.entityId}</td>
                <td>{event.actorUserId || event.actorClientId || '-'}</td>
                <td>{event.requestId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
