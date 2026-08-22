import React from 'react';
import { Send, Database, Sparkles, CheckCircle2, AlertCircle, Video } from 'lucide-react';
import { TelegramUser, IntegrationStatus } from '../types';
import { hapticFeedback } from '../lib/telegram';

interface HeaderProps {
  user: TelegramUser;
  integrations: IntegrationStatus | null;
  onOpenSqlModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, integrations, onOpenSqlModal }) => {
  const isSupabaseLive = integrations?.supabase?.configured;
  const isYtConnected = integrations?.youtube?.connected;
  const isTtConnected = integrations?.tiktok?.connected;

  return (
    <header className="sticky top-0 z-30 px-4 sm:px-6 py-3 border-b border-[#242F3D] bg-[#17212B]/95 backdrop-blur-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#3390EC] rounded-lg flex items-center justify-center shadow-md shadow-[#3390EC]/20 text-white flex-shrink-0">
            <Video className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-white">
                ShortsMaster
              </h1>
              <span className="text-[11px] font-medium text-[#708499] px-1.5 py-0.5 rounded bg-[#242F3D] border border-[#2B3A4A]">
                v1.0.4
              </span>
            </div>
            <p className="text-[11px] text-[#708499]">
              YouTube Shorts & TikTok Automation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Cloudflare D1 Status Pill */}
          <button
            onClick={() => {
              hapticFeedback.light();
              onOpenSqlModal();
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#242F3D] hover:bg-[#2B3A4A] border border-[#2B3A4A] rounded-full text-xs font-medium text-orange-400 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Нажмите для просмотра SQL-схемы Cloudflare D1"
          >
            <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
            <span className="hidden sm:inline">Connected to</span> Cloudflare D1
          </button>

          {/* User Avatar */}
          <div className="w-8 h-8 rounded-full bg-[#242F3D] border border-[#2B3A4A] flex items-center justify-center text-xs font-bold text-white shadow-sm overflow-hidden flex-shrink-0">
            {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
          </div>
        </div>
      </div>

      {/* Integration status ribbon */}
      <div className="max-w-5xl mx-auto flex items-center gap-2.5 mt-2 pt-2 border-t border-[#242F3D] text-[11px]">
        <div className="flex items-center gap-1.5 text-[#708499]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#708499]"></span>
          <span className="font-medium text-[#708499]">Каналы:</span>
        </div>

        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] transition-colors ${
          isYtConnected
            ? 'bg-red-500/10 text-red-400 border-red-500/25'
            : 'bg-[#242F3D] text-[#708499] border-[#2B3A4A]'
        }`}>
          {isYtConnected ? <CheckCircle2 className="w-3 h-3 text-red-400" /> : <AlertCircle className="w-3 h-3 text-[#708499]" />}
          <span>YouTube Shorts</span>
        </div>

        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] transition-colors ${
          isTtConnected
            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
            : 'bg-[#242F3D] text-[#708499] border-[#2B3A4A]'
        }`}>
          {isTtConnected ? <CheckCircle2 className="w-3 h-3 text-cyan-300" /> : <AlertCircle className="w-3 h-3 text-[#708499]" />}
          <span>TikTok</span>
        </div>
      </div>
    </header>
  );
};
