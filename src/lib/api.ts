import { Post, Preset, IntegrationStatus, UploadUrlResponse, PlatformType } from '../types';
import { getTelegramUser } from './telegram';

const getHeaders = () => {
  const user = getTelegramUser();
  return {
    'Content-Type': 'application/json',
    'x-telegram-user-id': String(user.id),
    'x-telegram-username': user.username || '',
  };
};

export const api = {
  // 1. Upload URL generator (Pre-signed URL for Supabase Storage)
  async getUploadUrl(fileName: string, contentType: string): Promise<UploadUrlResponse> {
    const res = await fetch('/api/get-upload-url', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fileName, contentType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload URL request failed' }));
      throw new Error(err.error || 'Ошибка получения URL для загрузки');
    }
    return res.json();
  },

  // 2. Direct or Chunked upload to storage with progress tracking and abort support
  async uploadFileToStorage(
    uploadData: UploadUrlResponse,
    file: File,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (signal?.aborted) {
      throw new DOMException('Загрузка отменена пользователем', 'AbortError');
    }

    // If a direct signed URL (e.g. Supabase S3 / R2 signed URL) is provided
    if (uploadData.directUpload && uploadData.uploadUrl.startsWith('http')) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadData.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);

        if (uploadData.token) {
          xhr.setRequestHeader('Authorization', `Bearer ${uploadData.token}`);
        }

        if (signal) {
          signal.addEventListener('abort', () => {
            xhr.abort();
            reject(new DOMException('Загрузка отменена пользователем', 'AbortError'));
          });
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress?.(100);
            resolve(uploadData.publicUrl);
          } else {
            this.uploadFileInChunks(uploadData.path || file.name, file, onProgress, signal)
              .then(resolve)
              .catch(reject);
          }
        };

        xhr.onerror = () => {
          this.uploadFileInChunks(uploadData.path || file.name, file, onProgress, signal)
            .then(resolve)
            .catch(reject);
        };

        xhr.send(file);
      });
    }

    // Otherwise, upload reliably in small binary chunks (~512KB) to prevent 503/timeout limits
    return this.uploadFileInChunks(uploadData.path || file.name, file, onProgress, signal);
  },

  async uploadFileInChunks(
    fileId: string,
    file: File,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const user = getTelegramUser();
    const cleanFileId = fileId.replace(/[^a-zA-Z0-9._-]/g, '_');
    const CHUNK_SIZE = 512 * 1024; // 512 KB chunks
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    let publicUrl = `/api/videos/${encodeURIComponent(cleanFileId)}`;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (signal?.aborted) {
        throw new DOMException('Загрузка отменена пользователем', 'AbortError');
      }

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);

      const params = new URLSearchParams({
        fileId: cleanFileId,
        chunkIndex: String(chunkIndex),
        totalChunks: String(totalChunks),
        fileName: file.name,
        fileSize: String(file.size),
      });

      const response = await fetch(`/api/upload-chunk?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'video/mp4',
          'x-telegram-user-id': String(user.id),
        },
        body: chunkBlob,
        signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errJson.error || `Ошибка загрузки блока ${chunkIndex + 1}/${totalChunks} (${response.status})`);
      }

      const result = await response.json();
      if (result.publicUrl) {
        publicUrl = result.publicUrl;
      }

      if (onProgress) {
        const percent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        onProgress(percent);
      }
    }

    return publicUrl;
  },

  async uploadFileFallback(file: File, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<string> {
    const user = getTelegramUser();
    const cleanId = `${user.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    return this.uploadFileInChunks(cleanId, file, onProgress, signal);
  },

  // 3. Posts API
  async getPosts(): Promise<Post[]> {
    const res = await fetch('/api/posts', { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки списка постов');
    const data = await res.json();
    return data.posts || [];
  },

  async createPost(data: {
    video_url: string;
    caption: string;
    platforms: PlatformType[];
    scheduled_at: string;
    publish_now?: boolean;
  }): Promise<Post> {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Не удалось создать пост' }));
      throw new Error(err.error || 'Не удалось создать пост');
    }
    return res.json();
  },

  async deletePost(id: string): Promise<void> {
    const res = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления поста');
  },

  async retryPost(id: string): Promise<Post> {
    const res = await fetch(`/api/posts/${id}/retry`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Не удалось запустить публикацию повторно');
    return res.json();
  },

  // 4. Presets API
  async getPresets(): Promise<Preset[]> {
    const res = await fetch('/api/presets', { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки пресетов');
    const data = await res.json();
    return data.presets || [];
  },

  async createPreset(preset: Omit<Preset, 'id' | 'user_id' | 'created_at'>): Promise<Preset> {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(preset),
    });
    if (!res.ok) throw new Error('Ошибка создания пресета');
    return res.json();
  },

  async updatePreset(id: string, preset: Partial<Preset>): Promise<Preset> {
    const res = await fetch(`/api/presets/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(preset),
    });
    if (!res.ok) throw new Error('Ошибка обновления пресета');
    return res.json();
  },

  async deletePreset(id: string): Promise<void> {
    const res = await fetch(`/api/presets/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления пресета');
  },

  // 5. Integrations API (Cloudflare D1 & OAuth status)
  async getUserStatus(telegramId?: string): Promise<{ hasYouTube: boolean; hasTikTok: boolean }> {
    const id = telegramId || getTelegramUser().id;
    try {
      const res = await fetch(`/api/user/status?telegram_id=${id}`, { headers: getHeaders() });
      if (res.ok) {
        return res.json();
      }
    } catch (e) {
      console.warn('Could not fetch user status from /api/user/status:', e);
    }
    return { hasYouTube: false, hasTikTok: false };
  },

  async getIntegrations(): Promise<IntegrationStatus> {
    const user = getTelegramUser();
    try {
      // First check D1 status
      const userStatus = await this.getUserStatus(String(user.id));
      const res = await fetch('/api/integrations/status', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        return {
          youtube: {
            connected: data.youtube?.connected || userStatus.hasYouTube,
            channel_title: data.youtube?.channel_title,
            channel_id: data.youtube?.channel_id,
          },
          tiktok: {
            connected: data.tiktok?.connected || userStatus.hasTikTok,
            display_name: data.tiktok?.display_name,
            open_id: data.tiktok?.open_id,
          },
          d1: {
            configured: true,
            database: 'shortsmaster-db',
          },
        };
      }
      return {
        youtube: { connected: userStatus.hasYouTube },
        tiktok: { connected: userStatus.hasTikTok },
        d1: { configured: true },
      };
    } catch (err) {
      return {
        youtube: { connected: false },
        tiktok: { connected: false },
        d1: { configured: false },
      };
    }
  },

  async disconnectIntegration(platform: 'youtube' | 'tiktok'): Promise<void> {
    const user = getTelegramUser();
    // Try Cloudflare D1 disconnect endpoint
    await fetch(`/api/user/disconnect?telegram_id=${user.id}&platform=${platform}`, {
      method: 'POST',
      headers: getHeaders(),
    }).catch(() => {});

    // Also call server-side disconnect if running local server
    await fetch(`/api/integrations/disconnect/${platform}`, {
      method: 'POST',
      headers: getHeaders(),
    }).catch(() => {});
  },

  // 6. Manual Cron trigger
  async runCron(): Promise<{ processed: number; results: any[] }> {
    const res = await fetch('/api/publish-cron', {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка выполнения cron');
    return res.json();
  },
};
