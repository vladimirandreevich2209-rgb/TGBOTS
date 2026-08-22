export type PlatformType = 'youtube' | 'tiktok';

export type PostStatus = 'scheduled' | 'publishing' | 'published' | 'failed';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface Preset {
  id: string;
  user_id: number;
  title: string;
  text: string;
  hashtags: string;
  created_at?: string;
}

export interface Post {
  id: string;
  user_id: number;
  video_url: string;
  caption: string;
  platforms: PlatformType[];
  scheduled_at: string;
  status: PostStatus;
  error_message?: string | null;
  published_ids?: {
    youtube_video_id?: string;
    tiktok_publish_id?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface IntegrationStatus {
  youtube: {
    connected: boolean;
    channel_title?: string;
    channel_id?: string;
    expires_at?: number;
  };
  tiktok: {
    connected: boolean;
    display_name?: string;
    open_id?: string;
  };
  d1?: {
    configured: boolean;
    database?: string;
  };
}

export interface VideoValidationResult {
  isValid: boolean;
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  isVertical: boolean;
  isDurationValid: boolean;
  errors: string[];
}

export interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  path: string;
  token?: string;
  directUpload?: boolean;
}
