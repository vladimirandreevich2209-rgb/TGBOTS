-- ====================================================================
-- SUPABASE SQL SCHEMA FOR TELEGRAM MINI APP AUTOPOSTING
-- YouTube Shorts & TikTok Auto-Poster Database Definition
-- ====================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create `users` table
-- Stores telegram users and their OAuth refresh/access tokens
CREATE TABLE IF NOT EXISTS public.users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    auth_tokens JSONB DEFAULT '{}'::jsonb,
    -- Structure of auth_tokens:
    -- {
    --   "youtube": {
    --     "access_token": "...",
    --     "refresh_token": "...",
    --     "expiry_date": 1700000000000,
    --     "channel_title": "My Channel",
    --     "channel_id": "UC..."
    --   },
    --   "tiktok": {
    --     "access_token": "...",
    --     "refresh_token": "...",
    --     "expires_in": 86400,
    --     "open_id": "...",
    --     "display_name": "@creator"
    --   }
    -- }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create `presets` table
-- Templates for titles, descriptions, and hashtag groups
CREATE TABLE IF NOT EXISTS public.presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES public.users(telegram_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    text TEXT,
    hashtags TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create `posts` table
-- Scheduled and published video tasks
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES public.users(telegram_id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    caption TEXT,
    platforms JSONB NOT NULL DEFAULT '["youtube", "tiktok"]'::jsonb,
    -- e.g. ["youtube", "tiktok"] or ["youtube"]
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    -- Statuses: 'scheduled' (запланировано), 'publishing' (в процессе), 'published' (опубликовано), 'failed' (ошибка)
    error_message TEXT,
    published_ids JSONB DEFAULT '{}'::jsonb,
    -- e.g. {"youtube_video_id": "dQw4w9WgXcQ", "tiktok_publish_id": "v_pub_123"}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled_at 
ON public.posts (status, scheduled_at) 
WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_posts_user_id 
ON public.posts (user_id);

CREATE INDEX IF NOT EXISTS idx_presets_user_id 
ON public.presets (user_id);

-- 6. Storage Bucket setup instructions for Supabase Storage:
-- Run in Supabase SQL editor or create bucket 'shorts_videos' in Storage UI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('shorts_videos', 'shorts_videos', true) ON CONFLICT DO NOTHING;

-- 7. Row Level Security (RLS) policies (Optional for service-role backend execution)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to users" ON public.users FOR ALL USING (true);
CREATE POLICY "Service role has full access to presets" ON public.presets FOR ALL USING (true);
CREATE POLICY "Service role has full access to posts" ON public.posts FOR ALL USING (true);

-- Allow public read/write if using anon key with Telegram ID header or direct client calls
CREATE POLICY "Allow public read-write for anon development" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for presets" ON public.presets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);

-- 8. Seed initial sample presets (Optional)
INSERT INTO public.presets (id, user_id, title, text, hashtags)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 12345678, '🔥 Трендовый Шортс', 'Смотри до конца! Ставь лайк и подписывайся на канал.', '#shorts #tiktok #тренды #рек #топ #reels #viral'),
    ('22222222-2222-2222-2222-222222222222', 12345678, '💻 IT & Разработка лайфхак', 'Полезный совет для разработчиков и дизайнеров. Сохраняй, чтобы не потерять!', '#coding #developer #it #programming #tips #webdev #технологии'),
    ('33333333-3333-3333-3333-333333333333', 12345678, '🚀 Мотивация и Продуктивность', 'Каждый день — это шаг к твоей главной цели. Не сдавайся!', '#motivation #success #саморазвитие #бизнес #цели #дисциплина')
ON CONFLICT DO NOTHING;
