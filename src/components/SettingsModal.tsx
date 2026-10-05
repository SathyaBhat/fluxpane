import { useState } from 'react';
import { fetch as tauriFetch, ResponseType } from '@tauri-apps/api/http';

interface Props {
  onSave: (url: string, key: string) => void;
  onClose: () => void;
  initialUrl?: string;
  initialKey?: string;
  openLinksInBrowser: boolean;
  onOpenLinksInBrowserChange: (value: boolean) => void;
}

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && (window as unknown as { __TAURI__: unknown }).__TAURI__ !== undefined;
};

export default function SettingsModal({
  onSave,
  onClose,
  initialUrl,
  initialKey,
  openLinksInBrowser,
  onOpenLinksInBrowserChange,
}: Props) {
  const [url, setUrl] = useState(initialUrl || '');
  const [key, setKey] = useState(initialKey || '');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const testConnection = async (testUrl: string, testKey: string): Promise<{ success: boolean; error?: string }> => {
    const apiUrl = `${testUrl}/v1/me`;

    if (isTauri()) {
      // Use Tauri HTTP API
      try {
        const response = await tauriFetch(apiUrl, {
          method: 'GET',
          headers: {
            'X-Auth-Token': testKey,
            'Content-Type': 'application/json',
          },
          responseType: ResponseType.JSON,
        });

        if (response.status >= 200 && response.status < 300) {
          return { success: true };
        } else if (response.status === 401) {
          return { success: false, error: 'Invalid API key. Please check your credentials.' };
        } else {
          return { success: false, error: `Connection failed: ${response.status}` };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to connect: ${errorMsg}` };
      }
    } else {
      // Use browser fetch
      try {
        const response = await fetch(apiUrl, {
          headers: { 'X-Auth-Token': testKey },
        });

        if (response.ok) {
          return { success: true };
        } else if (response.status === 401) {
          return { success: false, error: 'Invalid API key. Please check your credentials.' };
        } else {
          return { success: false, error: `Connection failed: ${response.statusText}` };
        }
      } catch (err) {
        return { success: false, error: 'Failed to connect. Please check the URL and make sure Miniflux is accessible.' };
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setError('');

    const result = await testConnection(url, key);

    if (result.success) {
      onSave(url, key);
    } else {
      setError(result.error || 'Failed to connect. Please check the URL and make sure Miniflux is accessible.');
    }

    setTesting(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>🔧 Miniflux Settings</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
          Enter your Miniflux server details to connect.
        </p>
        {error && (
          <div style={{ 
            color: 'var(--red)', 
            background: 'color-mix(in srgb, var(--red) 10%, transparent)',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '15px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Server URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://miniflux.example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="your-api-key"
              required
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--overlay0)', marginTop: '5px', display: 'block' }}>
              Find this in Settings → API Keys in your Miniflux web interface
            </span>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={openLinksInBrowser}
              onChange={(e) => onOpenLinksInBrowserChange(e.target.checked)}
            />
            <span>
              <strong>Open links in default browser</strong>
              <small>Use your system browser instead of opening links in FluxPane.</small>
            </span>
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ display: initialUrl ? 'block' : 'none' }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={testing}>
              {testing ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
