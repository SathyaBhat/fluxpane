export interface Feed {
  id: number;
  user_id: number;
  title: string;
  site_url: string;
  feed_url: string;
  checked_at: string;
  etag_header: string;
  last_modified_header: string;
  parsing_error_count: number;
  parsing_error_message: string;
  scraped_rules: string;
  rewrite_rules: string;
  blocker_rules: string;
  keeplist_rules: string;
  crawler: boolean;
  category: Category;
  hide_globally: boolean;
  username?: string;
  password?: string;
}

export interface DiscoveredFeed {
  url: string;
  title: string;
  type: string;
}

export interface Category {
  id: number;
  user_id: number;
  title: string;
}

export interface Entry {
  id: number;
  user_id: number;
  feed_id: number;
  status: "unread" | "read" | "removed";
  hash: string;
  title: string;
  url: string;
  comments_url: string;
  published_at: string;
  content: string;
  author: string;
  starred: boolean;
  enclosures: Enclosure[] | null;
  read_time: number;
  feed: Feed;
  tags: string[];
}

export interface Enclosure {
  id: number;
  user_id: number;
  entry_id: number;
  url: string;
  file_size: number;
  mime_type: string;
}

export interface User {
  id: number;
  username: string;
  is_admin: boolean;
  theme: string;
  language: string;
  timezone: string;
  entry_direction: string;
  entries_per_page: number;
  keyboard_shortcuts: boolean;
}

export interface EntriesResponse {
  total: number;
  entries: Entry[];
}

export interface MinifluxConfig {
  baseUrl: string;
  apiKey: string;
}

export interface FeedCounters {
  reads: Record<string, number>;
  unreads: Record<string, number>;
}
