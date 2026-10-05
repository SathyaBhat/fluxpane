import { fetch as tauriFetch, ResponseType, Body } from '@tauri-apps/api/http';
import type { Feed, Category, Entry, EntriesResponse, User, MinifluxConfig, FeedCounters } from '../types/miniflux';

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && (window as unknown as { __TAURI__: unknown }).__TAURI__ !== undefined;
};

class MinifluxClient {
  private _baseUrl: string = '';
  private _headers: Record<string, string> = {};

  init(newConfig: MinifluxConfig) {
    this._baseUrl = newConfig.baseUrl + '/v1';
    this._headers = {
      'X-Auth-Token': newConfig.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async get<T>(endpoint: string): Promise<T> {
    if (isTauri()) {
      const response = await tauriFetch(`${this._baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this._headers,
        responseType: ResponseType.JSON,
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data as T;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.data}`);
      }
    } else {
      const response = await fetch(`${this._baseUrl}${endpoint}`, {
        headers: this._headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    }
  }

  private async put<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
    if (isTauri()) {
      const response = await tauriFetch(`${this._baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: this._headers,
        body: body ? Body.json(body) : undefined,
        responseType: ResponseType.JSON,
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data as T;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.data}`);
      }
    } else {
      const response = await fetch(`${this._baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: this._headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    }
  }

  private async post<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
    if (isTauri()) {
      const response = await tauriFetch(`${this._baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this._headers,
        body: body ? Body.json(body) : undefined,
        responseType: ResponseType.JSON,
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data as T;
      } else {
        const data = response.data as { error_message?: string } | undefined;
        throw new Error(data?.error_message || `HTTP ${response.status}: ${response.data}`);
      }
    } else {
      const response = await fetch(`${this._baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this._headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => undefined) as { error_message?: string } | undefined;
        throw new Error(data?.error_message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    }
  }

  private async requestWithParams<T>(endpoint: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }

    const url = `${this._baseUrl}${endpoint}?${searchParams.toString()}`;

    if (isTauri()) {
      const response = await tauriFetch(url, {
        method: 'GET',
        headers: this._headers,
        responseType: ResponseType.JSON,
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data as T;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.data}`);
      }
    } else {
      const response = await fetch(url, {
        headers: this._headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getUser();
      return true;
    } catch {
      return false;
    }
  }

  async getUser(): Promise<User> {
    return this.get('/me');
  }

  async getFeeds(): Promise<Feed[]> {
    return this.get('/feeds');
  }

  async getCategories(): Promise<Category[]> {
    return this.get('/categories');
  }

  async createCategory(title: string): Promise<Category> {
    return this.post('/categories', { title });
  }

  async createFeed(feedUrl: string, categoryId?: number): Promise<{ feed_id: number }> {
    return this.post('/feeds', {
      feed_url: feedUrl,
      ...(categoryId ? { category_id: categoryId } : {}),
    });
  }

  async getEntries(
    feedId?: number,
    status?: string,
    order: string = 'published_at',
    direction: string = 'desc',
    limit: number = 100,
    offset: number = 0,
    starred?: boolean,
    categoryId?: number
  ): Promise<EntriesResponse> {
    const params: Record<string, string | number | boolean | undefined> = {
      order,
      direction,
      limit,
      offset,
    };

    if (status) params.status = status;
    if (feedId) params.feed_id = feedId;
    if (starred !== undefined) params.starred = starred;
    if (categoryId) params.category_id = categoryId;

    return this.requestWithParams('/entries', params);
  }

  async getEntry(entryId: number): Promise<Entry> {
    return this.get(`/entries/${entryId}`);
  }

  async updateEntries(entryIds: number[], status: 'read' | 'unread'): Promise<void> {
    return this.put('/entries', {
      entry_ids: entryIds,
      status,
    });
  }

  async toggleBookmark(entryId: number): Promise<void> {
    return this.put(`/entries/${entryId}/bookmark`);
  }

  async markCategoryAsRead(categoryId: number): Promise<void> {
    return this.put(`/categories/${categoryId}/mark-all-as-read`);
  }

  async markFeedAsRead(feedId: number): Promise<void> {
    return this.put(`/feeds/${feedId}/mark-all-as-read`);
  }

  async getFeedCounters(): Promise<FeedCounters> {
    return this.get('/feeds/counters');
  }

  async fetchEntryContent(entryId: number): Promise<{ content: string }> {
    return this.get(`/entries/${entryId}/fetch-content`);
  }
}

export const miniflux = new MinifluxClient();
