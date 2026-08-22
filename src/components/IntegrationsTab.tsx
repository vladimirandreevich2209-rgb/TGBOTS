import React, { useState, useEffect } from 'react';
import {
  Link2,
  Youtube,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Unlink,
  Database,
  Terminal,
  HelpCircle,
  Copy,
  Check,
  Send,
} from 'lucide-react';
import { IntegrationStatus, TelegramUser } from '../types';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { hapticFeedback } from '../lib/telegram';

interface IntegrationsTabProps {
  user: TelegramUser;
  integrations: IntegrationStatus | null;
  onRefresh: () => void;
  onOpenSqlModal: () => void;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
  user,
  integrations,
  onRefresh,
  onOpenSqlModal,
}) => {
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);

  // Listen for Supabase auth state changes & load initial session
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        hapticFeedback.success();
        onRefresh();
      } else {
        setSupabaseUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onRefresh]);

  // Listen for OAuth success message from popup (for Google/YouTube)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        hapticFeedback.success();
        setConnectingPlatform(null);
        onRefresh();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRefresh]);

  // Direct TikTok OAuth via Supabase
  const handleTikTokAuth = async () => {
    hapticFeedback.medium();
    setConnectingPlatform('tiktok');

    if (!supabase) {
      alert('Supabase client не инициализирован. Проверьте переменные VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Netlify / .env.');
      setConnectingPlatform(null);
      return;
    }

    try {
      // Use skipBrowserRedirect to safely handle popups and prevent iframe blocking (chromewebdata error)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'tiktok' as any,
        options: {
          redirectTo: window.location.origin,
          scopes: 'user.info.basic,user.info.profile,video.upload,video.list',
          skipBrowserRedirect: true,
        }
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        // Open OAuth in popup or new tab to avoid iframe X-Frame-Options blocking
        const isIframe = window !== window.parent;
        if (isIframe) {
          const popup = window.open(data.url, '_blank', 'width=600,height=750,scrollbars=yes,status=yes');
          if (!popup) {
            window.location.href = data.url;
          }
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err: any) {
      console.error('Ошибка входа TikTok:', err);
      alert(`Ошибка входа через TikTok: ${err.message || err}`);
      hapticFeedback.error();
    } finally {
      setConnectingPlatform(null);
    }
  };

  // Direct Google/YouTube OAuth via Supabase
  const handleGoogleAuth = async () => {
    hapticFeedback.medium();
    setConnectingPlatform('google');

    if (!supabase) {
      alert('Supabase client не инициализирован. Проверьте переменные VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Netlify / .env.');
      setConnectingPlatform(null);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: true,
        }
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        const isIframe = window !== window.parent;
        if (isIframe) {
          const popup = window.open(data.url, '_blank', 'width=600,height=750,scrollbars=yes,status=yes');
          if (!popup) {
            window.location.href = data.url;
          }
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err: any) {
      console.error('Ошибка входа Google/YouTube:', err);
      alert(`Ошибка входа через Google: ${err.message || err}`);
      hapticFeedback.error();
    } finally {
      setConnectingPlatform(null);
    }
  };

  // Connect via OAuth
  const handleConnect = async (platform: 'google' | 'tiktok') => {
    if (platform === 'google') {
      return handleGoogleAuth();
    }
    if (platform === 'tiktok') {
      return handleTikTokAuth();
    }
  };

  // Disconnect platform
  const handleDisconnect = async (platform: 'youtube' | 'tiktok') => {
    if (!confirm(`Отключить интеграцию с ${platform === 'youtube' ? 'YouTube' : 'TikTok'}?`)) {
      return;
    }
    hapticFeedback.light();
    try {
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
        setSupabaseUser(null);
      }
      await api.disconnectIntegration(platform).catch(() => {});
      hapticFeedback.success();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Ошибка отключения');
      hapticFeedback.error();
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    hapticFeedback.light();
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isYtConnected =
    integrations?.youtube?.connected ||
    supabaseUser?.app_metadata?.provider === 'google' ||
    supabaseUser?.identities?.some((i: any) => i.provider === 'google');

  const ytDisplayName =
    integrations?.youtube?.channel_title ||
    supabaseUser?.user_metadata?.full_name ||
    supabaseUser?.user_metadata?.name ||
    supabaseUser?.email ||
    'YouTube Shorts Channel';

  const isTtConnected =
    integrations?.tiktok?.connected ||
    supabaseUser?.app_metadata?.provider === 'tiktok' ||
    supabaseUser?.identities?.some((i: any) => i.provider === 'tiktok');
  
  const ttDisplayName =
    integrations?.tiktok?.display_name ||
    supabaseUser?.user_metadata?.full_name ||
    supabaseUser?.user_metadata?.name ||
    supabaseUser?.email ||
    '@tiktok_creator';

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  return (
    <div className="p-4 sm:p-6 pb-28 max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
          Интеграции и Аккаунты
        </h2>
        <p className="text-xs text-[#708499]">
          Управление OAuth 2.0 токенами для автоматической публикации в соцсети
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. YouTube Data API v3 (Shorts) */}
        <div className="p-5 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-600/20 flex-shrink-0">
                  <Youtube className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    YouTube Data API v3
                  </h3>
                  <p className="text-xs text-[#708499]">
                    Автопостинг в YouTube Shorts
                  </p>
                </div>
              </div>

              <div
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                  isYtConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                    : 'bg-[#242F3D] text-[#708499] border border-[#2B3A4A]'
                }`}
              >
                {isYtConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Подключено</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-[#708499]" />
                    <span>Отключено</span>
                  </>
                )}
              </div>
            </div>

            {isYtConnected ? (
              <div className="p-3.5 rounded-xl bg-[#242F3D] border border-[#2B3A4A] space-y-2 text-xs">
                <div className="flex justify-between items-center text-[#708499]">
                  <span>Канал:</span>
                  <span className="font-semibold text-white">
                    {ytDisplayName}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#708499]">
                  <span>ID канала:</span>
                  <span className="font-mono text-[11px] text-white">
                    {integrations?.youtube?.channel_id || 'UC_connected_id'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#708499]">
                  <span>Разрешения:</span>
                  <span className="text-[11px] text-red-400 font-mono">youtube.upload</span>
                </div>

                <button
                  onClick={() => handleDisconnect('youtube')}
                  className="w-full mt-2 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Отключить YouTube</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#708499] leading-relaxed">
                Требуется разрешение на загрузку видеороликов через Google OAuth 2.0. Токены сохраняются в Supabase.
              </p>
            )}
          </div>

          {!isYtConnected && (
            <button
              onClick={() => handleConnect('google')}
              disabled={connectingPlatform === 'google'}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-[0.98] transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>
                {connectingPlatform === 'google' ? 'Подключение...' : 'Подключить YouTube Shorts'}
              </span>
            </button>
          )}
        </div>

        {/* 2. TikTok Content Posting API */}
        <div className="p-5 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black text-sm shadow-md flex-shrink-0">
                  TT
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    TikTok Content API
                  </h3>
                  <p className="text-xs text-[#708499]">
                    Прямая публикация в TikTok
                  </p>
                </div>
              </div>

              <div
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                  isTtConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                    : 'bg-[#242F3D] text-[#708499] border border-[#2B3A4A]'
                }`}
              >
                {isTtConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Подключено</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-[#708499]" />
                    <span>Отключено</span>
                  </>
                )}
              </div>
            </div>

            {isTtConnected ? (
              <div className="p-3.5 rounded-xl bg-[#242F3D] border border-[#2B3A4A] space-y-2 text-xs">
                <div className="flex justify-between items-center text-[#708499]">
                  <span>Аккаунт:</span>
                  <span className="font-semibold text-cyan-300">
                    {ttDisplayName}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#708499]">
                  <span>Open ID:</span>
                  <span className="font-mono text-[11px] text-white">
                    {integrations?.tiktok?.open_id || 'open_id_123'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#708499]">
                  <span>Разрешения:</span>
                  <span className="text-[11px] text-cyan-300 font-mono">video.upload, video.publish</span>
                </div>

                <button
                  onClick={() => handleDisconnect('tiktok')}
                  className="w-full mt-2 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Отключить TikTok</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#708499] leading-relaxed">
                Авторизация через TikTok Login Kit для загрузки видео через Content Posting API v2.
              </p>
            )}
          </div>

          {!isTtConnected && (
            <button
              onClick={() => handleConnect('tiktok')}
              disabled={connectingPlatform === 'tiktok'}
              className="w-full py-3 px-4 rounded-xl bg-[#242F3D] hover:bg-[#2B3A4A] text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>
                {connectingPlatform === 'tiktok' ? 'Подключение...' : 'Подключить TikTok'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Supabase & Database Storage Info */}
      <div className="p-5 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#242F3D] border border-[#2B3A4A] flex items-center justify-center text-[#3390EC]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Supabase PostgreSQL & Storage
            </h3>
            <p className="text-xs text-[#708499]">
              Хранилище видеороликов (9:16) и реляционная база данных
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#242F3D] border border-[#2B3A4A] space-y-1">
            <span className="text-[#708499]">Storage Bucket:</span>
            <p className="font-mono text-emerald-400 font-semibold">shorts_videos</p>
          </div>
          <div className="p-3 rounded-xl bg-[#242F3D] border border-[#2B3A4A] space-y-1">
            <span className="text-[#708499]">Таблицы БД:</span>
            <p className="font-mono text-white font-semibold">users, presets, posts</p>
          </div>
        </div>

        <button
          onClick={() => {
            hapticFeedback.light();
            onOpenSqlModal();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-[#242F3D] hover:bg-[#2B3A4A] border border-[#2B3A4A] text-[#3390EC] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Database className="w-4 h-4" />
          <span>Открыть SQL-скрипт схемы Supabase</span>
        </button>
      </div>

      {/* 4. OAuth Callback & Webhook Helper for Developer */}
      <div className="p-5 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Shield className="w-4 h-4 text-[#3390EC]" />
          <span>Настройки Redirect URI для Google Cloud и TikTok Developers</span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <span className="text-[11px] text-[#708499]">Google Redirect URI:</span>
            <div className="flex items-center gap-2 bg-[#242F3D] px-3 py-2 rounded-xl border border-[#2B3A4A] font-mono text-[11px] text-white">
              <span className="truncate flex-1">{currentOrigin}/api/oauth/google/callback</span>
              <button
                onClick={() => copyToClipboard(`${currentOrigin}/api/oauth/google/callback`, 'google_cb')}
                className="p-1 text-[#708499] hover:text-white cursor-pointer"
              >
                {copiedField === 'google_cb' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-[#708499]">TikTok Redirect URI:</span>
            <div className="flex items-center gap-2 bg-[#242F3D] px-3 py-2 rounded-xl border border-[#2B3A4A] font-mono text-[11px] text-white">
              <span className="truncate flex-1">{currentOrigin}/api/oauth/tiktok/callback</span>
              <button
                onClick={() => copyToClipboard(`${currentOrigin}/api/oauth/tiktok/callback`, 'tiktok_cb')}
                className="p-1 text-[#708499] hover:text-white cursor-pointer"
              >
                {copiedField === 'tiktok_cb' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
