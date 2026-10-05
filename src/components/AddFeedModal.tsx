import { useState } from 'react';
import type { Category, DiscoveredFeed } from '../types/miniflux';
import { miniflux } from '../services/miniflux';

interface Props {
  categories: Category[];
  initialCategoryId?: number;
  onClose: () => void;
  onAdded: () => void;
}

const NEW_CATEGORY = '__new__';

export default function AddFeedModal({ categories, initialCategoryId, onClose, onAdded }: Props) {
  const [feedUrl, setFeedUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId ? String(initialCategoryId) : '');
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const creatingCategory = categoryId === NEW_CATEGORY;
  const [candidates, setCandidates] = useState<DiscoveredFeed[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      let resolvedUrl = feedUrl.trim();
      if (candidates.length > 0) {
        resolvedUrl = selectedCandidate;
      } else {
        // Resolve a website URL to its RSS/Atom feed; if discovery fails, let createFeed try the URL as-is
        const found = await miniflux.discoverFeeds(resolvedUrl).catch(() => []);
        if (found.length > 1) {
          setCandidates(found);
          setSelectedCandidate(found[0].url);
          setSubmitting(false);
          return;
        }
        if (found.length === 1) resolvedUrl = found[0].url;
      }

      let targetCategoryId = categoryId && !creatingCategory ? Number(categoryId) : undefined;
      if (creatingCategory) {
        const created = await miniflux.createCategory(newCategoryTitle.trim());
        targetCategoryId = created.id;
      }
      await miniflux.createFeed(resolvedUrl,targetCategoryId);
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add feed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal">
        <h3>➕ Add Feed</h3>
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
            <label>Feed URL</label>
            <input
              type="url"
              value={feedUrl}
              onChange={(e) => {
                setFeedUrl(e.target.value);
                setCandidates([]);
              }}
              placeholder="https://example.com (feed is found automatically)"
              required
              autoFocus
            />
          </div>
          {candidates.length > 0 && (
            <div className="form-group">
              <label>Multiple feeds found — choose one</label>
              <select value={selectedCandidate} onChange={(e) => setSelectedCandidate(e.target.value)}>
                {candidates.map((c) => (
                  <option key={c.url} value={c.url}>{c.title || c.url} ({c.type})</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Category (optional)</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Use Miniflux default</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.title}</option>
              ))}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
          </div>
          {creatingCategory && (
            <div className="form-group">
              <label>New category name</label>
              <input
                type="text"
                value={newCategoryTitle}
                onChange={(e) => setNewCategoryTitle(e.target.value)}
                placeholder="e.g. Tech News"
                required
                autoFocus
              />
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !feedUrl.trim() || (creatingCategory && !newCategoryTitle.trim())}>
              {submitting ? 'Adding...' : 'Add Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
