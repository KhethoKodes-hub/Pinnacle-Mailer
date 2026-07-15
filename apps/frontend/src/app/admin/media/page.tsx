'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminJson, SessionExpiredError } from '../../../lib/client-api';

type MediaItem = {
  id: string;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  caption: string | null;
};

export default function MediaPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [draftMetadata, setDraftMetadata] = useState<
    Record<string, { altText: string; caption: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function handleSessionExpired() {
    router.push('/login');
    router.refresh();
  }

  async function loadMedia() {
    try {
      const data = await fetchAdminJson<MediaItem[]>('/api/bff/media');
      setAssets(data);
      setDraftMetadata(
        data.reduce<Record<string, { altText: string; caption: string }>>((acc, item) => {
          acc[item.id] = {
            altText: item.altText || '',
            caption: item.caption || '',
          };
          return acc;
        }, {}),
      );
    } catch (loadError) {
      if (loadError instanceof SessionExpiredError) {
        handleSessionExpired();
        return;
      }

      setError('Could not load media assets.');
    }
  }

  useEffect(() => {
    void loadMedia();
  }, [router]);

  async function onUpload(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsUploading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch('/api/bff/media/upload', {
      method: 'POST',
      body: formData,
    });

    setIsUploading(false);

    if (!response.ok) {
      try {
        const payload = (await response.json()) as { code?: string };
        if (response.status === 401 && (payload.code === 'session_expired' || payload.code === 'reauth_required')) {
          handleSessionExpired();
          return;
        }
      } catch {
        // no-op, fallback to generic upload failure
      }

      setError('Upload failed.');
      return;
    }

    form.reset();
    setSuccess('Media uploaded.');
    await loadMedia();
  }

  async function saveMetadata(id: string) {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    const metadata = draftMetadata[id];
    if (!metadata) {
      setIsSaving(false);
      return;
    }

    try {
      await fetchAdminJson(`/api/bff/media/${id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          altText: metadata.altText,
          caption: metadata.caption,
        }),
      });
      setSuccess('Media metadata updated.');
      await loadMedia();
    } catch (requestError) {
      if (requestError instanceof SessionExpiredError) {
        handleSessionExpired();
        return;
      }

      setError(requestError instanceof Error ? requestError.message : 'Could not update metadata.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main>
      <h2>Media</h2>
      <p className="admin-intro">Upload and manage approved email imagery.</p>

      <form className="upload-form" onSubmit={onUpload}>
        <label htmlFor="file">Upload image</label>
        <input id="file" name="file" type="file" accept="image/*" required />
        <button type="submit" className="primary-button" disabled={isUploading}>
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {success ? <p className="status-success">{success}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Filename</th>
              <th>MIME type</th>
              <th>Size (KB)</th>
              <th>Alt text</th>
              <th>Caption</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.filename}</td>
                <td>{asset.mimeType}</td>
                <td>{Math.round(asset.sizeBytes / 1024)}</td>
                <td>
                  <input
                    value={draftMetadata[asset.id]?.altText || ''}
                    onChange={(event) =>
                      setDraftMetadata((current) => ({
                        ...current,
                        [asset.id]: {
                          altText: event.target.value,
                          caption: current[asset.id]?.caption || '',
                        },
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    value={draftMetadata[asset.id]?.caption || ''}
                    onChange={(event) =>
                      setDraftMetadata((current) => ({
                        ...current,
                        [asset.id]: {
                          altText: current[asset.id]?.altText || '',
                          caption: event.target.value,
                        },
                      }))
                    }
                  />
                </td>
                <td>
                  <button
                    className="secondary-button"
                    onClick={() => void saveMetadata(asset.id)}
                    disabled={isSaving || isUploading}
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
