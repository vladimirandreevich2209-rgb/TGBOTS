import React, { useState } from 'react';
import { Database, Copy, Check, X, Shield, Terminal } from 'lucide-react';
import { hapticFeedback } from '../lib/telegram';

interface SqlSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlSchemaModal: React.FC<SqlSchemaModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlCode = `-- SUPABASE POSTGRESQL SCHEMA FOR AUTOPOSTING
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table (stores Telegram ID & OAuth refresh tokens)
CREATE TABLE IF NOT EXISTS public.users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    auth_tokens JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Presets table (templates for titles, text & hashtags)
CREATE TABLE IF NOT EXISTS public.presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES public.users(telegram_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    text TEXT,
    hashtags TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Posts table (scheduled and published video queue)
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES public.users(telegram_id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    caption TEXT,
    platforms JSONB NOT NULL DEFAULT '["youtube", "tiktok"]'::jsonb,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    error_message TEXT,
    published_ids JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast scheduled queries
CREATE INDEX IF NOT EXISTS idx_posts_status_scheduled_at 
ON public.posts (status, scheduled_at) WHERE status = 'scheduled';

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to users" ON public.users FOR ALL USING (true);
CREATE POLICY "Service role full access to presets" ON public.presets FOR ALL USING (true);
CREATE POLICY "Service role full access to posts" ON public.posts FOR ALL USING (true);`;

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
            <div className="w-9 h-9 rounded-xl bg-[#242F3D] border border-[#2B3A4A] text-[#3390EC] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Supabase SQL Schema</h3>
              <p className="text-[11px] text-[#708499]">Схема таблиц users, presets, posts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-[#3390EC] hover:bg-[#2884E0] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
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
            <p className="font-sans font-semibold text-[#3390EC] flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              <span>Инструкция по установке:</span>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[#708499] font-sans text-xs">
              <li>Откройте панель Supabase → <b className="text-white">SQL Editor</b>.</li>
              <li>Вставьте и выполните данный скрипт.</li>
              <li>Создайте Storage Bucket с именем <code className="text-emerald-400 font-bold bg-[#17212B] px-1 py-0.5 rounded">shorts_videos</code> (Public).</li>
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
