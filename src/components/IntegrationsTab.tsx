import React, { useState, useEffect, useCallback } from 'react';
import {
  Youtube,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Unlink,
  Database,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { IntegrationStatus, TelegramUser } from '../types';
import { getTelegramId, hapticFeedback } from '../lib/telegram';
import { api } from '../lib/api';

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
  const [d1Status, setD1Status] = useState<{ hasYouTube: boolean; hasTikTok: boolean }>({
    hasYouTube: false,
    hasTikTok: false,
  });
  const [isStatusLoading, setIsStatusLoading] = useState(false);

  // Fetch status directly from Cloudflare Pages Function / D1
  const fetchUserStatus = useCallback(async () => {
    const telegramId = getTelegramId();
    setIsStatusLoading(true);
    try {
      const res = await fetch(`/api/user/status?telegram_id=${encodeURIComponent(telegramId)}`);
      if (res.ok) {
        const data = await res.json();
        setD1Status({
          hasYouTube: Boolean(data.hasYouTube),
          hasTikTok: Boolean(data.hasTikTok),
        });
      }
    } catch (err) {
      console.warn('Failed to fetch user status from /api/user/status:', err);
    } finally {
      setIsStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserStatus();
  }, [fetchUserStatus]);

  // Listen for OAuth success popup messages and window focus
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data?.type === 'OAUTH_AUTH_SUCCESS' ||
        event.data?.type === 'oauth_success' ||
        event.data === 'oauth_success'
      ) {
        hapticFeedback.success();
        setConnectingPlatform(null);
        fetchUserStatus();
        onRefresh();
      }
    };

    const handleFocus = () => {
      fetchUserStatus();
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUserStatus, onRefresh]);

  // 1. YouTube Shorts Connect via Google OAuth 2.0
  const handleYouTubeAuth = () => {
    hapticFeedback.medium();
    setConnectingPlatform('youtube');

    const telegramId = getTelegramId();
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      alert('Ошибка: VITE_GOOGLE_CLIENT_ID не настроен в переменных окружения.');
      setConnectingPlatform(null);
      return;
    }
    
    // Use deployed Cloudflare Pages URL or current origin for callback
    const redirectUri =
      typeof window !== 'undefined' && window.location.hostname.includes('pages.dev')
        ? 'https://shortsmaster.pages.dev/api/youtube/callback'
        : `${window.location.origin}/api/youtube/callback`;

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state: telegramId,
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Open OAuth in popup or direct navigation
    const isIframe = typeof window !== 'undefined' && window !== window.parent;
    if (isIframe) {
      const popup = window.open(
        googleAuthUrl,
        'oauth_popup_youtube',
        'width=600,height=750,scrollbars=yes,status=yes'
      );
      if (!popup) {
        window.location.href = googleAuthUrl;
      }
    } else {
      window.location.href = googleAuthUrl;
    }
  };

  // 2. TikTok Connect via /api/tiktok/url
  const handleTikTokAuth = async () => {
    hapticFeedback.medium();
    setConnectingPlatform('tiktok');

    const telegramId = getTelegramId();
    try {
      const res = await fetch(`/api/tiktok/url?telegram_id=${encodeURIComponent(telegramId)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Не удалось сгенерировать ссылку авторизации TikTok (проверьте переменные окружения TIKTOK_CLIENT_KEY в Cloudflare)');
      }
      const data = await res.json();
      if (!data.url) {
        throw new Error('Пустой URL авторизации TikTok от сервера');
      }

      const isIframe = typeof window !== 'undefined' && window !== window.parent;
      if (isIframe) {
        const popup = window.open(
          data.url,
          'oauth_popup_tiktok',
          'width=600,height=750,scrollbars=yes,status=yes'
        );
        if (!popup) {
          window.location.href = data.url;
        }
      } else {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Ошибка входа TikTok:', err);
      alert(`Ошибка: ${err.message || 'Не удалось запустить авторизацию TikTok'}`);
      hapticFeedback.error();
    } finally {
      setConnectingPlatform(null);
    }
  };

  // Disconnect platform
  const handleDisconnect = async (platform: 'youtube' | 'tiktok') => {
    if (!confirm(`Отключить интеграцию с ${platform === 'youtube' ? 'YouTube' : 'TikTok'}?`)) {
      return;
    }
    hapticFeedback.light();
    try {
      const telegramId = getTelegramId();
      await fetch(`/api/user/disconnect?telegram_id=${encodeURIComponent(telegramId)}&platform=${platform}`, {
        method: 'POST',
      });
      await api.disconnectIntegration(platform).catch(() => {});
      
      setD1Status((prev) => ({
        ...prev,
        [platform === 'youtube' ? 'hasYouTube' : 'hasTikTok']: false,
      }));
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

  const isYtConnected = d1Status.hasYouTube || Boolean(integrations?.youtube?.connected);
  const isTtConnected = d1Status.hasTikTok || Boolean(integrations?.tiktok?.connected);

  const currentOrigin =
    typeof window !== 'undefined' && window.location.hostname.includes('pages.dev')
      ? 'https://shortsmaster.pages.dev'
      : typeof window !== 'undefined'
      ? window.location.origin
      : 'https://shortsmaster.pages.dev';

  return (
    <div className="p-4 sm:p-6 pb-28 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Интеграции и Аккаунты
          </h2>
          <p className="text-xs text-[#708499]">
            Хранение токенов в Cloudflare D1 (SQLite) • Telegram ID: <span className="font-mono text-cyan-400">{getTelegramId()}</span>
          </p>
        </div>

        <button
          onClick={() => {
            hapticFeedback.light();
            fetchUserStatus();
            onRefresh();
          }}
          disabled={isStatusLoading}
          className="p-2 rounded-xl bg-[#242F3D] hover:bg-[#2B3A4A] border border-[#2B3A4A] text-[#708499] hover:text-white transition cursor-pointer"
          title="Обновить статус токенов"
        >
          <RefreshCw className={`w-4 h-4 ${isStatusLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
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
                    YouTube Shorts
                  </h3>
                  <p className="text-xs text-[#708499]">
                    YouTube Data API v3
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
                  <span>Статус токена:</span>
                  <span className="font-semibold text-emerald-400">
                    Refresh Token активен (D1)
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
                Авторизация через Google OAuth 2.0. Токен refresh_token сохраняется в Cloudflare D1 для автоматической публикации.
              </p>
            )}
          </div>

          {!isYtConnected && (
            <button
              onClick={handleYouTubeAuth}
              disabled={connectingPlatform === 'youtube'}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-[0.98] transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>
                {connectingPlatform === 'youtube' ? 'Подключение...' : 'Подключить YouTube Shorts'}
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
                  <span>Статус токена:</span>
                  <span className="font-semibold text-cyan-300">
                    Access Token активен (D1)
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
                Авторизация через TikTok Login Kit v2. Токен сохраняется в таблице users базы данных Cloudflare D1.
              </p>
            )}
          </div>

          {!isTtConnected && (
            <button
              onClick={handleTikTokAuth}
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

      {/* 3. Cloudflare D1 Database Info */}
      <div className="p-5 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#242F3D] border border-[#2B3A4A] flex items-center justify-center text-orange-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Cloudflare D1 Database (SQLite)
            </h3>
            <p className="text-xs text-[#708499]">
              Привязка: <code className="font-mono text-orange-400">DB</code> • Таблица пользователей: <code className="font-mono text-white">users</code>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#242F3D] border border-[#2B3A4A] space-y-1">
            <span className="text-[#708499]">Поля таблицы users:</span>
            <p className="font-mono text-emerald-400 font-semibold text-[11px]">
              telegram_id, youtube_refresh_token, tiktok_access_token, updated_at
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#242F3D] border border-[#2B3A4A] space-y-1">
            <span className="text-[#708499]">Хостинг & Edge Functions:</span>
            <p className="font-mono text-cyan-300 font-semibold">shortsmaster.pages.dev</p>
          </div>
        </div>

        <button
          onClick={() => {
            hapticFeedback.light();
            onOpenSqlModal();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-[#242F3D] hover:bg-[#2B3A4A] border border-[#2B3A4A] text-orange-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Database className="w-4 h-4" />
          <span>Схема таблицы Cloudflare D1 (SQL)</span>
        </button>
      </div>

      {/* 4. OAuth Callback Helper for Developer */}
      <div className="p-5 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Shield className="w-4 h-4 text-[#3390EC]" />
          <span>Настройки Redirect URI для Cloudflare Pages</span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <span className="text-[11px] text-[#708499]">Google Redirect URI (в Google Cloud Console):</span>
            <div className="flex items-center gap-2 bg-[#242F3D] px-3 py-2 rounded-xl border border-[#2B3A4A] font-mono text-[11px] text-white">
              <span className="truncate flex-1">https://shortsmaster.pages.dev/api/youtube/callback</span>
              <button
                onClick={() => copyToClipboard('https://shortsmaster.pages.dev/api/youtube/callback', 'google_cb')}
                className="p-1 text-[#708499] hover:text-white cursor-pointer"
              >
                {copiedField === 'google_cb' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-[#708499]">TikTok Redirect URI (в TikTok Developer Portal):</span>
            <div className="flex items-center gap-2 bg-[#242F3D] px-3 py-2 rounded-xl border border-[#2B3A4A] font-mono text-[11px] text-white">
              <span className="truncate flex-1">https://shortsmaster.pages.dev/api/tiktok/callback</span>
              <button
                onClick={() => copyToClipboard('https://shortsmaster.pages.dev/api/tiktok/callback', 'tiktok_cb')}
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
