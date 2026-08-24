import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Trash2,
  Youtube,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Post, PostStatus } from '../types';
import { api } from '../lib/api';
import { hapticFeedback } from '../lib/telegram';

interface CalendarTabProps {
  posts: Post[];
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToUpload: () => void;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({
  posts,
  isLoading,
  onRefresh,
  onNavigateToUpload,
}) => {
  const [filter, setFilter] = useState<'all' | PostStatus>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRunningCron, setIsRunningCron] = useState(false);
  const [cronMessage, setCronMessage] = useState<string | null>(null);

  // Filtered posts
  const filteredPosts = posts.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  // Counters
  const counts = {
    all: posts.length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    published: posts.filter((p) => p.status === 'published').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  };

  // Retry post
  const handleRetry = async (id: string) => {
    hapticFeedback.light();
    setRetryingId(id);
    try {
      await api.retryPost(id);
      hapticFeedback.success();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Ошибка перезапуска');
      hapticFeedback.error();
    } finally {
      setRetryingId(null);
    }
  };

  // Delete post
  const handleDelete = async (id: string) => {
    if (!confirm('Удалить эту публикацию из расписания?')) return;
    hapticFeedback.light();
    setDeletingId(id);
    try {
      await api.deletePost(id);
      hapticFeedback.success();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления');
      hapticFeedback.error();
    } finally {
      setDeletingId(null);
    }
  };

  // Trigger manual cron
  const handleTriggerCron = async () => {
    hapticFeedback.medium();
    setIsRunningCron(true);
    setCronMessage(null);
    try {
      const res = await api.runCron();
      setCronMessage(`Cron обработал ${res.processed} задач(и)`);
      hapticFeedback.success();
      onRefresh();
    } catch (err: any) {
      setCronMessage('Ошибка запуска Cron: ' + err.message);
      hapticFeedback.error();
    } finally {
      setIsRunningCron(false);
    }
  };

  const formatScheduledTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);
      const diffHours = Math.round(diffMs / 3600000);

      const formatted = d.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

      if (diffMs > 0) {
        if (diffMins < 60) return `Через ${diffMins} мин (${formatted})`;
        if (diffHours < 24) return `Через ${diffHours} ч (${formatted})`;
      } else if (diffMs < 0) {
        const absHours = Math.abs(diffHours);
        if (absHours < 24) return `${absHours} ч назад (${formatted})`;
      }

      return formatted;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28 max-w-4xl mx-auto space-y-5">
      {/* Header & Cron Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Очередь и Календарь
          </h2>
          <p className="text-xs text-[#708499]">
            Хранилище расписания: <code className="text-[11px] bg-[#242F3D] px-1.5 py-0.5 rounded border border-[#2B3A4A] text-white">Cloudflare D1 (posts)</code>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-[#17212B] border border-[#2B3A4A] hover:border-[#3390EC] text-[#708499] hover:text-white transition cursor-pointer"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#3390EC]' : ''}`} />
          </button>

          <button
            onClick={handleTriggerCron}
            disabled={isRunningCron}
            className="px-3.5 py-2 rounded-xl bg-[#242F3D] hover:bg-[#2B3A4A] border border-[#2B3A4A] text-[#3390EC] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
            title="Тестовый запуск Cron для публикации готовых постов"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningCron ? 'animate-pulse' : ''}`} />
            <span>{isRunningCron ? 'Выполняется...' : 'Запуск Cron'}</span>
          </button>
        </div>
      </div>

      {/* Cron Notification */}
      {cronMessage && (
        <div className="p-3 rounded-xl bg-[#17212B] border border-[#3390EC]/40 text-[#3390EC] text-xs flex items-center justify-between shadow-md">
          <span>{cronMessage}</span>
          <button onClick={() => setCronMessage(null)} className="text-[#708499] hover:text-white text-xs p-1">
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-[#17212B] rounded-2xl border border-[#2B3A4A] text-xs">
        <button
          onClick={() => {
            hapticFeedback.selection();
            setFilter('all');
          }}
          className={`py-2 rounded-xl font-semibold transition cursor-pointer ${
            filter === 'all'
              ? 'bg-[#3390EC] text-white shadow-sm'
              : 'text-[#708499] hover:text-white'
          }`}
        >
          Все ({counts.all})
        </button>

        <button
          onClick={() => {
            hapticFeedback.selection();
            setFilter('scheduled');
          }}
          className={`py-2 rounded-xl font-semibold transition cursor-pointer ${
            filter === 'scheduled'
              ? 'bg-[#242F3D] text-[#3390EC] border border-[#2B3A4A] shadow-sm'
              : 'text-[#708499] hover:text-white'
          }`}
        >
          План ({counts.scheduled})
        </button>

        <button
          onClick={() => {
            hapticFeedback.selection();
            setFilter('published');
          }}
          className={`py-2 rounded-xl font-semibold transition cursor-pointer ${
            filter === 'published'
              ? 'bg-[#242F3D] text-emerald-400 border border-[#2B3A4A] shadow-sm'
              : 'text-[#708499] hover:text-white'
          }`}
        >
          Готово ({counts.published})
        </button>

        <button
          onClick={() => {
            hapticFeedback.selection();
            setFilter('failed');
          }}
          className={`py-2 rounded-xl font-semibold transition cursor-pointer ${
            filter === 'failed'
              ? 'bg-[#242F3D] text-rose-400 border border-[#2B3A4A] shadow-sm'
              : 'text-[#708499] hover:text-white'
          }`}
        >
          Ошибки ({counts.failed})
        </button>
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-14 px-6 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-3 shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-[#242F3D] mx-auto flex items-center justify-center text-[#708499] border border-[#2B3A4A]">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {filter === 'all'
                ? 'Нет запланированных публикаций'
                : `Нет постов со статусом "${filter}"`}
            </p>
            <p className="text-xs text-[#708499] mt-1">
              Загрузите видеоролик 9:16 и настройте время публикации
            </p>
          </div>
          <button
            onClick={() => {
              hapticFeedback.light();
              onNavigateToUpload();
            }}
            className="px-5 py-2.5 bg-[#3390EC] hover:bg-[#2B83D8] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-lg shadow-[#3390EC]/20 active:scale-95 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Создать публикацию</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const isScheduled = post.status === 'scheduled';
            const isPublished = post.status === 'published';
            const isPublishing = post.status === 'publishing';
            const isFailed = post.status === 'failed';

            return (
              <div
                key={post.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-3.5 relative overflow-hidden shadow-sm hover:border-[#3390EC]/40 transition"
              >
                {/* Header: Platforms & Status */}
                <div className="flex items-center justify-between gap-2">
                  {/* Platform Pills */}
                  <div className="flex items-center gap-1.5">
                    {post.platforms.includes('youtube') && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/25 text-xs font-medium">
                        <Youtube className="w-3.5 h-3.5" />
                        <span>Shorts</span>
                      </span>
                    )}
                    {post.platforms.includes('tiktok') && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 text-xs font-medium">
                        <span className="font-bold text-[11px]">TT</span>
                        <span>TikTok</span>
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isScheduled && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#242F3D] text-[#3390EC] border border-[#2B3A4A] text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Запланировано</span>
                      </span>
                    )}
                    {isPublishing && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/25 text-xs font-medium">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Публикация...</span>
                      </span>
                    )}
                    {isPublished && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Опубликовано</span>
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/25 text-xs font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Ошибка</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Video Info & Caption */}
                <div className="flex gap-4">
                  {/* Video mini preview / playable */}
                  <div className="relative w-18 h-26 sm:w-20 sm:h-28 rounded-xl bg-black overflow-hidden flex-shrink-0 border border-[#2B3A4A] group">
                    <video
                      src={post.video_url}
                      preload="metadata"
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-white font-medium line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {post.caption}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[#708499] mt-2.5">
                      <Clock className="w-3.5 h-3.5 text-[#3390EC]" />
                      <span>{formatScheduledTime(post.scheduled_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Error Message Details */}
                {isFailed && post.error_message && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    <p className="font-semibold text-xs text-rose-400 mb-0.5">Причина ошибки:</p>
                    <p className="text-xs text-rose-200">{post.error_message}</p>
                  </div>
                )}

                {/* Published Links Info */}
                {isPublished && post.published_ids && (
                  <div className="pt-1 flex flex-wrap gap-3 text-xs">
                    {post.published_ids.youtube_video_id && (
                      <a
                        href={
                          post.published_ids.youtube_video_id.startsWith('yt_')
                            ? '#'
                            : `https://youtube.com/shorts/${post.published_ids.youtube_video_id}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-red-400 hover:text-red-300 font-mono flex items-center gap-1 hover:underline"
                      >
                        <Youtube className="w-3.5 h-3.5" />
                        <span>
                          {post.published_ids.youtube_video_id.startsWith('yt_')
                            ? `YT: ${post.published_ids.youtube_video_id}`
                            : 'Смотреть на YouTube ↗'}
                        </span>
                      </a>
                    )}
                    {post.published_ids.tiktok_publish_id && (
                      <span className="text-cyan-300 font-mono flex items-center gap-1">
                        <span>TT ID: {post.published_ids.tiktok_publish_id}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 border-t border-[#242F3D] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#708499] font-mono">
                    ID: {post.id}
                  </span>

                  <div className="flex items-center gap-2">
                    {isFailed && (
                      <button
                        onClick={() => handleRetry(post.id)}
                        disabled={retryingId === post.id}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${retryingId === post.id ? 'animate-spin' : ''}`} />
                        <span>Повторить</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={deletingId === post.id}
                      className="p-1.5 text-[#708499] hover:text-rose-400 transition cursor-pointer rounded-lg hover:bg-[#242F3D]"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
