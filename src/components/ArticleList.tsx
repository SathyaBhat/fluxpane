import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Entry } from '../types/miniflux';
import type { EntryFilter } from '../App';
import { openLink } from '../services/openLink';

interface Props {
  entries: Entry[];
  authorEntries: Entry[];
  loading: boolean;
  title: string;
  count: number;
  selectedEntryId?: number | null;
  onEntrySelect: (entry: Entry) => void;
  onRefresh: () => void;
  onMarkAllRead: (entryIds: number[]) => void;
  selectedStatuses: EntryFilter[];
  onStatusChange: (statuses: EntryFilter[]) => void;
  onToggleEntryRead?: (entryId: number, currentStatus: 'read' | 'unread') => void;
  openLinksInBrowser: boolean;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  entry: Entry | null;
}

const STATUS_OPTIONS: { value: EntryFilter; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'starred', label: 'Starred' },
  { value: 'all', label: 'All' },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function statusLabel(selected: EntryFilter[]): string {
  if (selected.includes('all') || selected.length === 0) return 'All';
  if (selected.length === 1) return STATUS_OPTIONS.find(o => o.value === selected[0])?.label ?? 'All';
  return `${selected.length} selected`;
}

function authorLabel(selected: string[]): string {
  if (selected.length === 0) return 'All Authors';
  if (selected.length === 1) return selected[0].length > 18 ? selected[0].slice(0, 16) + '…' : selected[0];
  return `${selected.length} authors`;
}

function AuthorCount({ count }: { count: number }) {
  return <span className="filter-check-count">{count}</span>;
}

interface DropdownProps {
  label: string;
  active: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  dropdownRef: React.Ref<HTMLDivElement>;
}

function FilterDropdown({ label, active, isOpen, onToggle, children, dropdownRef }: DropdownProps) {
  return (
    <div className="filter-dropdown" ref={dropdownRef}>
      <button
        className={`filter-dropdown-btn ${active ? 'active' : ''}`}
        onClick={onToggle}
      >
        {label} <span className="filter-dropdown-arrow">▾</span>
      </button>
      {isOpen && (
        <div className="filter-dropdown-menu">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckItem({ checked, label, onClick, count }: { checked: boolean; label: string; onClick: () => void; count?: number }) {
  return (
    <button className="filter-check-item" onClick={onClick}>
      <span className={`filter-check-box ${checked ? 'checked' : ''}`}>
        {checked && '✓'}
      </span>
      <span className="filter-check-label">{label}</span>
      {count !== undefined && <AuthorCount count={count} />}
    </button>
  );
}

export default function ArticleList({
  entries,
  authorEntries,
  loading,
  title,
  count,
  selectedEntryId,
  onEntrySelect,
  onRefresh,
  onMarkAllRead,
  selectedStatuses,
  onStatusChange,
  onToggleEntryRead,
  openLinksInBrowser,
}: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false, x: 0, y: 0, entry: null,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set());

  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const authorRef = useRef<HTMLDivElement | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, x: 0, y: 0, entry: null });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
      if (authorRef.current && !authorRef.current.contains(e.target as Node)) {
        setAuthorOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('wheel', closeContextMenu, { passive: true });
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('wheel', closeContextMenu);
    };
  }, [closeContextMenu]);

  const authors = useMemo(() => {
    const counts = new Map<string, number>();
    const isAll = selectedStatuses.includes('all') || selectedStatuses.length === 0;
    const statusEntries = isAll
      ? authorEntries
      : authorEntries.filter(e =>
        (selectedStatuses.includes('starred') && e.starred) ||
        (selectedStatuses.includes('unread') && e.status === 'unread') ||
        (selectedStatuses.includes('read') && e.status === 'read')
      );

    for (const e of statusEntries) {
      if (e.author) counts.set(e.author, (counts.get(e.author) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [authorEntries, selectedStatuses]);

  // Reset author filter and pinned entries on feed/category switch
  useEffect(() => {
    setSelectedAuthors([]);
    setPinnedIds(new Set());
  }, [title]);

  // Unpin when article is closed
  useEffect(() => {
    if (selectedEntryId == null) {
      setPinnedIds(new Set());
    }
  }, [selectedEntryId]);

  const applyFilters = useCallback((base: Entry[]) => {
    let result = base;

    // Client-side status filter — pinned entries (opened this session) always pass through
    const isAll = selectedStatuses.includes('all') || selectedStatuses.length === 0;
    if (!isAll) {
      result = result.filter(e => {
        if (pinnedIds.has(e.id)) return true;
        if (selectedStatuses.includes('starred') && e.starred) return true;
        if (selectedStatuses.includes('unread') && e.status === 'unread') return true;
        if (selectedStatuses.includes('read') && e.status === 'read') return true;
        return false;
      });
    }

    if (selectedAuthors.length > 0) {
      result = result.filter(e => pinnedIds.has(e.id) || (e.author != null && selectedAuthors.includes(e.author)));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        pinnedIds.has(e.id) ||
        e.title.toLowerCase().includes(q) ||
        e.feed.title.toLowerCase().includes(q) ||
        stripHtml(e.content || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [selectedStatuses, selectedAuthors, searchQuery, pinnedIds]);

  // `entries` is capped at the newest 100, but author counts come from `authorEntries`.
  // With an author selected, list from the full set so the list matches the counts.
  const visibleEntries = useMemo(
    () => applyFilters(selectedAuthors.length > 0 ? authorEntries : entries),
    [applyFilters, selectedAuthors, authorEntries, entries]
  );

  // Mark All Read covers every loaded matching entry, not just the capped list
  const unreadVisible = useMemo(
    () => applyFilters(authorEntries).filter(e => e.status === 'unread'),
    [applyFilters, authorEntries]
  );

  const handleStatusToggle = (value: EntryFilter) => {
    if (value === 'all') {
      onStatusChange(['all']);
      return;
    }
    const without = selectedStatuses.filter(s => s !== 'all');
    const next = without.includes(value)
      ? without.filter(s => s !== value)
      : [...without, value];
    onStatusChange(next.length === 0 ? ['all'] : next);
  };

  const handleAuthorToggle = (author: string) => {
    setSelectedAuthors(prev =>
      prev.includes(author) ? prev.filter(a => a !== author) : [...prev, author]
    );
  };

  const handleEntryClick = (entry: Entry) => {
    setPinnedIds(prev => new Set(prev).add(entry.id));
    onEntrySelect(entry);
  };

  const handleContextMenu = (e: React.MouseEvent, entry: Entry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, entry });
  };

  const handleToggleRead = () => {
    if (contextMenu.entry && onToggleEntryRead && contextMenu.entry.status !== 'removed') {
      onToggleEntryRead(contextMenu.entry.id, contextMenu.entry.status as 'read' | 'unread');
      closeContextMenu();
    }
  };

  const handleOpenOriginal = async () => {
    if (contextMenu.entry?.url) {
      try {
        await openLink(contextMenu.entry.url, openLinksInBrowser);
      } catch (err) {
        console.error('Failed to open link:', err);
      } finally {
        closeContextMenu();
      }
    }
  };

  const isStatusAll = selectedStatuses.includes('all') || selectedStatuses.length === 0;
  const hasAuthorFilter = selectedAuthors.length > 0;

  return (
    <main className="main-content">
      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={onRefresh}>🔄 Refresh</button>
      </div>

      <div className="filter-bar">
        {/* Status multi-select */}
        <FilterDropdown
          label={statusLabel(selectedStatuses)}
          active={!isStatusAll}
          isOpen={statusOpen}
          onToggle={() => setStatusOpen(o => !o)}
          dropdownRef={statusRef}
        >
          {STATUS_OPTIONS.map(opt => (
            <CheckItem
              key={opt.value}
              label={opt.label}
              checked={
                opt.value === 'all'
                  ? isStatusAll
                  : selectedStatuses.includes(opt.value)
              }
              onClick={() => handleStatusToggle(opt.value)}
            />
          ))}
        </FilterDropdown>

        {/* Author multi-select */}
        {authors.length > 0 && (
          <FilterDropdown
            label={authorLabel(selectedAuthors)}
            active={hasAuthorFilter}
            isOpen={authorOpen}
            onToggle={() => setAuthorOpen(o => !o)}
            dropdownRef={authorRef}
          >
            <CheckItem
              label="All Authors"
              checked={!hasAuthorFilter}
              onClick={() => setSelectedAuthors([])}
            />
            <div className="filter-dropdown-separator" />
            {authors.map(({ name, count }) => (
              <CheckItem
                key={name}
                label={name}
                checked={selectedAuthors.includes(name)}
                onClick={() => handleAuthorToggle(name)}
                count={count}
              />
            ))}
          </FilterDropdown>
        )}

        <div className="filter-bar-spacer" />

        <button
          className="btn btn-secondary filter-bar-btn"
          onClick={() => onMarkAllRead(unreadVisible.map(e => e.id))}
          disabled={unreadVisible.length === 0}
          title={hasAuthorFilter ? `Mark all read for ${authorLabel(selectedAuthors)}` : 'Mark all as read'}
        >
          ✓ Mark All Read
        </button>
      </div>

      <div className="articles-list scrollbar">
        <div className="articles-header">
          <h2>{title}</h2>
          <span className="articles-count">
            {visibleEntries.length !== count
              ? `${visibleEntries.length} / ${count} articles`
              : `${count} articles`}
          </span>
        </div>

        {loading && <div className="loading">Loading...</div>}

        {!loading && visibleEntries.length === 0 && (
          <div className="empty-state">
            <h3>No articles found</h3>
            <p>
              {isStatusAll || !selectedStatuses.includes('unread')
                ? 'No articles match the current filter.'
                : 'All caught up! Check back later for new content.'}
            </p>
          </div>
        )}

        {!loading && visibleEntries.map((entry) => (
          <article
            key={entry.id}
            className={`article-card ${entry.status === 'read' ? 'read' : ''}`}
            onClick={() => handleEntryClick(entry)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
          >
            <div className="article-header">
              <span className="article-feed">{entry.feed.title}</span>
              <span className="article-date">{formatDate(entry.published_at)}</span>
              {entry.status === 'unread' && <span className="unread-dot" />}
            </div>
            <h3 className="article-title">{entry.title}</h3>
            {entry.author && (
              <span className="article-author">{entry.author}</span>
            )}
            {entry.content && (
              <p className="article-excerpt">{stripHtml(entry.content)}</p>
            )}
          </article>
        ))}
      </div>

      {contextMenu.isOpen && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="context-menu-item" onClick={handleToggleRead}>
            {contextMenu.entry?.status === 'unread' ? '✓ Mark as Read' : '○ Mark as Unread'}
          </button>
          <button className="context-menu-item" onClick={handleOpenOriginal}>
            🔗 Open Original
          </button>
        </div>
      )}
    </main>
  );
}
