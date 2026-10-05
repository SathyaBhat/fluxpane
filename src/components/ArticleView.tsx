import { useEffect, useState } from 'react';
import type { Entry } from '../types/miniflux';
import { miniflux } from '../services/miniflux';
import { openLink } from '../services/openLink';

interface Props {
  entry: Entry | null;
  onClose: () => void;
  onToggleRead?: (entryId: number, currentStatus: 'read' | 'unread') => void;
  openLinksInBrowser: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ArticleView({ entry, onClose, onToggleRead, openLinksInBrowser }: Props) {
  const [fullContent, setFullContent] = useState<string | null>(null);

  useEffect(() => {
    setFullContent(null);

    if (!entry) return;

    let cancelled = false;

    const fetchContent = async () => {
      try {
        const data = await miniflux.fetchEntryContent(entry.id);
        if (!cancelled) {
          setFullContent(data.content);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch content:', err);
        }
      }
    };

    fetchContent();

    return () => {
      cancelled = true;
    };
  }, [entry?.id]);

  const handleToggleBookmark = async () => {
    if (!entry) return;
    try {
      await miniflux.toggleBookmark(entry.id);
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  const handleOpenOriginal = async () => {
    if (entry?.url) {
      try {
        await openLink(entry.url, openLinksInBrowser);
      } catch (err) {
        console.error('Failed to open link:', err);
      }
    }
  };

  const handleContentClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!openLinksInBrowser) return;

    const anchor = (event.target as HTMLElement).closest('a');
    const href = anchor?.href;
    if (!href) return;

    event.preventDefault();
    try {
      await openLink(href, true);
    } catch (err) {
      console.error('Failed to open link:', err);
    }
  };

  if (!entry) return null;

  const content = fullContent || entry.content;

  return (
    <div className={`article-view ${entry ? 'open' : ''}`}>
      <div className="article-view-header">
        <h3>{entry.feed.title}</h3>
        <div className="article-view-actions">
          <button className="btn btn-secondary" onClick={handleToggleBookmark}>
            {entry.starred ? '⭐' : '☆'} Star
          </button>
          {onToggleRead && (
            <button
              className="btn btn-secondary"
              onClick={() => onToggleRead(entry.id, entry.status as 'read' | 'unread')}
              title={entry.status === 'unread' ? 'Mark as read' : 'Mark as unread'}
            >
              {entry.status === 'unread' ? '✉ Mark Read' : '✉ Mark Unread'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleOpenOriginal}>
            🔗 Open
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>

      <div className="article-view-content scrollbar">
        <h1 className="article-view-title">{entry.title}</h1>
        <div className="article-view-meta">
          <span>By {entry.author || 'Unknown'}</span>
          <span>{formatDate(entry.published_at)}</span>
          {entry.read_time > 0 && <span>{entry.read_time} min read</span>}
        </div>
        <div 
          className="article-view-body"
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: content || '<p>No content available</p>' }}
        />
      </div>
    </div>
  );
}
