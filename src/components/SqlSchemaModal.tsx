import React, { useState } from 'react';
import { Database, Copy, Check, X, Terminal } from 'lucide-react';
import { hapticFeedback } from '../lib/telegram';

interface SqlSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlSchemaModal: React.FC<SqlSchemaModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlCode = `-- CLOUDFLARE D1 (SQLITE) SCHEMA FOR SHORTSMASTER
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
ON posts (status, scheduled_at);`;

  const handleCopy = () => {
    hapticFeedback.light();
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-[#17212B] border border-[#2B3A4A] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#2B3A4A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#242F3D] border border-[#2B3A4A] text-orange-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cloudflare D1 Schema (SQL)</h3>
              <p className="text-[11px] text-[#708499]">Схема таблиц users, presets, posts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано' : 'Копировать'}</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-[#708499] hover:text-white hover:bg-[#242F3D] rounded-lg transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content / SQL Code Box */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 font-mono text-xs">
          <div className="p-3.5 bg-[#242F3D] rounded-xl border border-[#2B3A4A] text-xs text-slate-300 space-y-1.5">
            <p className="font-sans font-semibold text-orange-400 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              <span>Создание таблиц через Wrangler CLI:</span>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[#708499] font-sans text-xs">
              <li>Откройте терминал в папке проекта.</li>
              <li>Выполните команду: <code className="text-white font-mono bg-[#0E1621] px-1.5 py-0.5 rounded">npx wrangler d1 execute DB --file=schema.sql</code></li>
              <li>Привяжите базу <b className="text-white">DB</b> в настройках Cloudflare Pages → <b>Settings → Functions → D1 Database Bindings</b>.</li>
            </ol>
          </div>

          <pre className="p-3.5 bg-[#0E1621] rounded-xl border border-[#2B3A4A] text-slate-300 overflow-x-auto text-[11px] leading-relaxed select-text font-mono">
            {sqlCode}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#2B3A4A] bg-[#17212B] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#242F3D] hover:bg-[#2B3A4A] text-xs text-white font-medium cursor-pointer transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
