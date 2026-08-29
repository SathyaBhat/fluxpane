import { useState, useEffect, useCallback } from 'react';
import type { Feed, Category, Entry, FeedCounters } from './types/miniflux';
import { miniflux } from './services/miniflux';
import { faviconService } from './services/favicon';
import { useTheme } from './hooks/useTheme';
import { ThemeSettingsInline } from './components/ThemeSettings';
import SettingsModal from './components/SettingsModal';
import AddFeedModal from './components/AddFeedModal';
import Sidebar from './components/Sidebar';
import ArticleList from './components/ArticleList';
import ArticleView from './components/ArticleView';

export type EntryFilter = 'unread' | 'read' | 'starred' | 'all';

interface Config {
  baseUrl: string;
  apiKey: string;
}

function App() {
  const { theme } = useTheme();
  const [config, setConfig] = useState<Config | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [authorEntries, setAuthorEntries] = useState<Entry[]>([]);
  const [feedCounters, setFeedCounters] = useState<FeedCounters | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  const [activeFeedTitle, setActiveFeedTitle] = useState('All Unread');
  const [showUnreadOnly, setShowUnreadOnly] = useState(() => {
    return localStorage.getItem('fluxpane-show-unread-only') === 'true';
  });
  const [selectedStatuses, setSelectedStatuses] = useState<EntryFilter[]>(['unread']);

  // Apply the theme colors to CSS variables on mount
  useEffect(() => {
    // Theme is applied via ThemeProvider, but we can add any additional
    // app-specific CSS variables here if needed
  }, [theme]);

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('fluxpane-config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        miniflux.init(parsed);
      } catch {
        setShowSettings(true);
      }
    } else {
      setShowSettings(true);
    }
  }, []);

  // Load feeds, categories, and counters when config is set
  const loadFeeds = useCallback(async () => {
    if (!config) return;
    try {
      const [feedsData, categoriesData, countersData] = await Promise.all([
        miniflux.getFeeds(),
        miniflux.getCategories(),
        miniflux.getFeedCounters(),
      ]);
      setFeeds(feedsData);
      setCategories(categoriesData);
      setFeedCounters(countersData);
    } catch (err) {
      console.error('Failed to load feeds:', err);
    }
  }, [config]);

  // Preload favicons when feeds change
  useEffect(() => {
    if (feeds.length > 0) {
      const siteUrls = feeds.map(f => f.site_url).filter(Boolean);
      faviconService.preloadFavicons(siteUrls).catch(console.error);
    }
  }, [feeds]);

  const loadEntries = useCallback(async (
    feedId?: number,
    statuses: EntryFilter[] = ['unread'],
    categoryId?: number
  ) => {
    if (!config) return;
    setLoading(true);
    try {
      const isAll = statuses.includes('all') || statuses.length === 0;
      const hasStarred = statuses.includes('starred');
      const hasUnread = statuses.includes('unread');
      const hasRead = statuses.includes('read');

      let apiStatus: string | undefined;
      let apiStarred: boolean | undefined;

      if (!isAll && hasStarred && !hasUnread && !hasRead) {
        apiStarred = true;
      } else if (!isAll && hasUnread && !hasRead && !hasStarred) {
        apiStatus = 'unread';
      } else if (!isAll && hasRead && !hasUnread && !hasStarred) {
        apiStatus = 'read';
      }

      const data = await miniflux.getEntries(
        feedId || undefined,
        apiStatus,
        undefined, undefined, undefined, undefined,
        apiStarred,
        categoryId || undefined
      );
      const allEntries = [...data.entries];
      let offset = data.entries.length;

      while (offset < data.total && data.entries.length > 0) {
        const page = await miniflux.getEntries(
          feedId || undefined,
          apiStatus,
          undefined, undefined, 1000, offset,
          apiStarred,
          categoryId || undefined
        );
        allEntries.push(...page.entries);
        if (page.entries.length === 0) break;
        offset += page.entries.length;
      }

      setEntries(allEntries.slice(0, 100));
      setAuthorEntries(allEntries);
      setTotalEntries(data.total);
    } catch (err) {
      console.error('Failed to load entries:', err);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (config) {
      loadFeeds();
      loadEntries(undefined, ['unread'], undefined);
    }
  }, [config, loadFeeds, loadEntries]);

  // Refresh counters/feeds on visibility change and every 5 minutes
  useEffect(() => {
    if (!config) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadFeeds();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const pollId = setInterval(loadFeeds, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollId);
    };
  }, [config, loadFeeds]);

  const handleSaveConfig = (url: string, key: string) => {
    const newConfig = { baseUrl: url, apiKey: key };
    localStorage.setItem('fluxpane-config', JSON.stringify(newConfig));
    setConfig(newConfig);
    miniflux.init(newConfig);
    setShowSettings(false);
  };

  const handleFeedSelect = (feedId: number | null, feedTitle: string) => {
    setSelectedFeedId(feedId);
    setSelectedCategoryId(null);
    setActiveFeedTitle(feedTitle);
    loadEntries(feedId || undefined, selectedStatuses, undefined);
  };

  const handleCategorySelect = (categoryId: number, categoryTitle: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedFeedId(null);
    setActiveFeedTitle(categoryTitle);
    loadEntries(undefined, selectedStatuses, categoryId);
  };

  const handleEntrySelect = async (entry: Entry) => {
    setSelectedEntry(entry);
    if (entry.status === 'unread') {
      try {
        await miniflux.updateEntries([entry.id], 'read');
        // Update in-place — keep the entry visible in the list
        setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'read' } : e));
        setAuthorEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'read' } : e));
        setSelectedEntry(prev => prev?.id === entry.id ? { ...prev, status: 'read' } : prev);
        const counters = await miniflux.getFeedCounters();
        setFeedCounters(counters);
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
  };

  const handleRefresh = () => {
    loadFeeds();
    loadEntries(selectedFeedId || undefined, selectedStatuses, selectedCategoryId || undefined);
  };

  const handleMarkAllRead = async (entryIds: number[]) => {
    if (entryIds.length === 0) return;
    try {
      await miniflux.updateEntries(entryIds, 'read');
      setEntries(prev => prev.map(e => entryIds.includes(e.id) ? { ...e, status: 'read' } : e));
      setAuthorEntries(prev => prev.map(e => entryIds.includes(e.id) ? { ...e, status: 'read' } : e));
      const counters = await miniflux.getFeedCounters();
      setFeedCounters(counters);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleToggleUnreadOnly = () => {
    setShowUnreadOnly(prev => {
      const newValue = !prev;
      localStorage.setItem('fluxpane-show-unread-only', String(newValue));
      return newValue;
    });
  };

  const handleStatusChange = (statuses: EntryFilter[]) => {
    setSelectedStatuses(statuses);
    loadEntries(selectedFeedId || undefined, statuses, selectedCategoryId || undefined);
  };

  const handleToggleEntryRead = async (entryId: number, currentStatus: 'read' | 'unread') => {
    const newStatus = currentStatus === 'unread' ? 'read' : 'unread';
    try {
      await miniflux.updateEntries([entryId], newStatus);
      setEntries(entries.map(e =>
        e.id === entryId ? { ...e, status: newStatus } : e
      ));
      if (selectedEntry?.id === entryId) {
        setSelectedEntry(prev => prev ? { ...prev, status: newStatus } : null);
      }
      const counters = await miniflux.getFeedCounters();
      setFeedCounters(counters);
    } catch (err) {
      console.error('Failed to toggle entry status:', err);
    }
  };
  const feedsByCategory = categories.map(cat => ({
    category: cat,
    feeds: feeds.filter(f => f.category.id === cat.id).map(f => ({
      id: f.id,
      title: f.title,
      category: f.category,
      site_url: f.site_url,
    })),
  }));

  // Use feed counters from API for unread counts
  const unreadCounts: Record<number, number> = feedCounters?.unreads || {};
  
  // Calculate total unread from feed counters
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="app">
      {showSettings && (
        <SettingsModal
          onSave={handleSaveConfig}
          onClose={() => config && setShowSettings(false)}
          initialUrl={config?.baseUrl || ''}
          initialKey={config?.apiKey || ''}
        />
      )}

      {showAddFeed && (
        <AddFeedModal
          categories={categories}
          onClose={() => setShowAddFeed(false)}
          onAdded={loadFeeds}
        />
      )}

      {showThemeSettings && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowThemeSettings(false);
        }}>
          <div className="modal" style={{ maxWidth: '450px' }}>
            <ThemeSettingsInline onClose={() => setShowThemeSettings(false)} />
          </div>
        </div>
      )}

      <Sidebar
        categories={feedsByCategory}
        unreadCounts={unreadCounts}
        totalUnread={totalUnread}
        onFeedSelect={handleFeedSelect}
        onCategorySelect={handleCategorySelect}
        onSettings={() => setShowSettings(true)}
        onThemeSettings={() => setShowThemeSettings(true)}
        onAddFeed={() => setShowAddFeed(true)}
        selectedFeedId={selectedFeedId}
        selectedCategoryId={selectedCategoryId}
        showUnreadOnly={showUnreadOnly}
        onToggleUnreadOnly={handleToggleUnreadOnly}
      />

      <ArticleList
        entries={entries}
        authorEntries={authorEntries}
        loading={loading}
        title={activeFeedTitle}
        count={totalEntries}
        selectedEntryId={selectedEntry?.id}
        onEntrySelect={handleEntrySelect}
        onRefresh={handleRefresh}
        onMarkAllRead={handleMarkAllRead}
        selectedStatuses={selectedStatuses}
        onStatusChange={handleStatusChange}
        onToggleEntryRead={handleToggleEntryRead}
      />

      <ArticleView
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onToggleRead={handleToggleEntryRead}
      />
    </div>
  );
}

export default App;
