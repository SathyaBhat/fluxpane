import { useEffect, useState } from 'react';
import { useFavicon } from '../hooks/useFavicon';

interface CategoryGroup {
  category: { id: number; title: string };
  feeds: { id: number; title: string; category: { id: number }; site_url: string }[];
}

interface Props {
  categories: CategoryGroup[];
  unreadCounts: Record<number, number>;
  totalUnread: number;
  onFeedSelect: (feedId: number | null, feedTitle: string) => void;
  onCategorySelect: (categoryId: number, categoryTitle: string) => void;
  onSettings: () => void;
  onThemeSettings?: () => void;
  onAddFeed: (categoryId?: number) => void;
  selectedFeedId: number | null;
  selectedCategoryId: number | null;
  showUnreadOnly: boolean;
  onToggleUnreadOnly: () => void;
}

function FeedIcon({ siteUrl, title }: { siteUrl: string; title: string }) {
  const { faviconUrl } = useFavicon(siteUrl);
  const [error, setError] = useState(false);

  if (faviconUrl && !error) {
    return (
      <img
        src={faviconUrl}
        alt=""
        className="feed-favicon"
        onError={() => setError(true)}
      />
    );
  }

  return <span className="feed-favicon-fallback">{title.charAt(0).toUpperCase()}</span>;
}

export default function Sidebar({
  categories,
  unreadCounts,
  totalUnread,
  onFeedSelect,
  onCategorySelect,
  onSettings,
  onThemeSettings,
  onAddFeed,
  selectedFeedId,
  selectedCategoryId,
  showUnreadOnly,
  onToggleUnreadOnly,
}: Props) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('fluxpane-collapsed-categories');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [menu, setMenu] = useState<{ x: number; y: number; categoryId: number; categoryTitle: string } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    // mousedown (not contextmenu) so the right-click that opened the menu doesn't close it
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const toggleCategory = (e: React.MouseEvent, categoryId: number) => {
    e.stopPropagation();
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      localStorage.setItem('fluxpane-collapsed-categories', JSON.stringify([...next]));
      return next;
    });
  };

  const filteredCategories = showUnreadOnly
    ? categories
        .map(({ category, feeds }) => ({
          category,
          feeds: feeds.filter(feed => (unreadCounts[feed.id] || 0) > 0),
        }))
        .filter(({ feeds }) => feeds.length > 0)
    : categories;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>🗞️ FluxPane</h1>
        <div
          className={`feed-item ${selectedFeedId === null && selectedCategoryId === null ? 'active' : ''}`}
          onClick={() => onFeedSelect(null, 'All Unread')}
        >
          <span className="feed-icon">📥</span>
          <span className="feed-name">All Unread</span>
          {totalUnread > 0 && <span className="feed-count">{totalUnread}</span>}
        </div>
        <div
          className={`feed-item ${selectedFeedId === -1 ? 'active' : ''}`}
          onClick={() => onFeedSelect(-1, 'Starred')}
        >
          <span className="feed-icon">⭐</span>
          <span className="feed-name">Starred</span>
        </div>

        <div className="sidebar-toggle" onClick={onToggleUnreadOnly}>
          <div className={`toggle-switch ${showUnreadOnly ? 'active' : ''}`}>
            <div className="toggle-thumb"></div>
          </div>
          <span className="toggle-label">Unread only</span>
        </div>
      </div>

      <div className="feed-categories scrollbar">
        {filteredCategories.map(({ category, feeds }) => {
          const isCollapsed = collapsedCategories.has(category.id);
          const categoryUnread = feeds.reduce((sum, f) => sum + (unreadCounts[f.id] || 0), 0);
          const isSelectedCategory = selectedCategoryId === category.id;

          return (
            <div key={category.id} className="category">
              <div className={`category-header ${isSelectedCategory ? 'active' : ''}`}>
                <button
                  className="category-name-btn"
                  onClick={() => onCategorySelect(category.id, category.title)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, categoryId: category.id, categoryTitle: category.title });
                  }}
                  title={`Show all articles in ${category.title}`}
                >
                  {category.title}
                  {categoryUnread > 0 && (
                    <span className="category-unread-count">{categoryUnread}</span>
                  )}
                </button>
                <button
                  className="category-collapse-btn"
                  onClick={(e) => toggleCategory(e, category.id)}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? '▶' : '▼'}
                </button>
              </div>

              {!isCollapsed && feeds.map((feed) => (
                <div
                  key={feed.id}
                  className={`feed-item ${selectedFeedId === feed.id ? 'active' : ''} ${unreadCounts[feed.id] > 0 ? 'unread' : ''}`}
                  onClick={() => onFeedSelect(feed.id, feed.title)}
                >
                  <span className="feed-icon-wrapper">
                    <FeedIcon siteUrl={feed.site_url} title={feed.title} />
                  </span>
                  <span className="feed-name">{feed.title}</span>
                  {unreadCounts[feed.id] > 0 && (
                    <span className="feed-count">{unreadCounts[feed.id]}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '15px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => onAddFeed()}>
          ➕ Add Feed
        </button>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onSettings}>
          ⚙️ Settings
        </button>
        {onThemeSettings && (
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onThemeSettings}>
            🎨 Theme
          </button>
        )}
      </div>

      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              onAddFeed(menu.categoryId);
              setMenu(null);
            }}
          >
            ➕ Add feed to “{menu.categoryTitle}”
          </button>
        </div>
      )}
    </aside>
  );
}
