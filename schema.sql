-- CLOUDFLARE D1 (SQLITE) SCHEMA FOR SHORTSMASTER
-- Привязка базы данных: DB

-- 1. Таблица пользователей и OAuth токенов
CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    youtube_refresh_token TEXT,
    tiktok_access_token TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Таблица пресетов (шаблоны заголовков и хештегов)
CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT,
    hashtags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- 3. Таблица запланированных и опубликованных постов
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    video_url TEXT NOT NULL,
    caption TEXT,
    platforms TEXT NOT NULL DEFAULT '["youtube","tiktok"]',
    scheduled_at DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    error_message TEXT,
    published_ids TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Индекс для быстрого опроса планировщика (Cron)
CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled_at 
ON posts (status, scheduled_at);
