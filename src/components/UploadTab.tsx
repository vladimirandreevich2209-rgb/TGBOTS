import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Film,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Calendar,
  Send,
  Youtube,
  Trash2,
  Tag,
  Loader2,
  XCircle,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { Preset, PlatformType } from '../types';
import { validateVideoFile, VideoMetadataValidation } from '../lib/videoValidator';
import { api } from '../lib/api';
import { hapticFeedback } from '../lib/telegram';

interface UploadTabProps {
  presets: Preset[];
  onUploadSuccess: () => void;
  onNavigateToCalendar: () => void;
}

export const UploadTab: React.FC<UploadTabProps> = ({
  presets,
  onUploadSuccess,
  onNavigateToCalendar,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<VideoMetadataValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('#shorts #tiktok #viral');
  const [platforms, setPlatforms] = useState<PlatformType[]>(['youtube', 'tiktok']);
  const [publishNow, setPublishNow] = useState(true);

  // Default scheduled time: 2 hours in the future
  const getDefaultScheduleTime = () => {
    const d = new Date(Date.now() + 2 * 3600 * 1000);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduleTime());

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    hapticFeedback.light();
    setSelectedFile(file);
    setUploadError(null);
    setIsSuccess(false);
    setIsValidating(true);

    // Auto fill title if empty
    if (!title) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();
      setTitle(cleanName);
    }

    try {
      const result = await validateVideoFile(file);
      setValidation(result);
      if (result.isValid) {
        hapticFeedback.success();
      } else {
        hapticFeedback.warning();
      }
    } catch (err: any) {
      setValidation(null);
      setUploadError(err.message || 'Ошибка проверки видео');
      hapticFeedback.error();
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearFile = () => {
    hapticFeedback.light();
    setSelectedFile(null);
    setValidation(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cancel in-flight upload
  const handleCancelUpload = () => {
    hapticFeedback.warning();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError('Загрузка отменена');
  };

  // Full form reset
  const handleResetAll = () => {
    hapticFeedback.medium();
    handleClearFile();
    setTitle('');
    setDescription('');
    setHashtags('#shorts #tiktok #viral');
    setPublishNow(true);
    setUploadProgress(0);
    setUploadError(null);
  };

  // Quick Preset Selection
  const applyPreset = (preset: Preset) => {
    hapticFeedback.selection();
    setTitle(preset.title);
    setDescription(preset.text);
    if (preset.hashtags) {
      setHashtags(preset.hashtags);
    }
  };

  // Toggle platform
  const togglePlatform = (p: PlatformType) => {
    hapticFeedback.selection();
    if (platforms.includes(p)) {
      if (platforms.length === 1) return;
      setPlatforms(platforms.filter((item) => item !== p));
    } else {
      setPlatforms([...platforms, p]);
    }
  };

  // Add quick tag
  const addQuickTag = (tag: string) => {
    hapticFeedback.selection();
    if (!hashtags.includes(tag)) {
      setHashtags((prev) => (prev ? `${prev.trim()} ${tag}` : tag));
    }
  };

  // Submit and Upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !validation?.isValid) {
      setUploadError('Пожалуйста, выберите валидный 9:16 видеоролик до 60 секунд');
      hapticFeedback.error();
      return;
    }

    if (!title.trim()) {
      setUploadError('Укажите заголовок видео');
      hapticFeedback.warning();
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsUploading(true);
    setUploadProgress(5);
    setUploadError(null);

    try {
      // 1. Get pre-signed upload URL from Supabase Storage via backend
      const uploadData = await api.getUploadUrl(selectedFile.name, selectedFile.type);
      setUploadProgress(15);

      if (abortController.signal.aborted) {
        throw new DOMException('Загрузка отменена пользователем', 'AbortError');
      }

      // 2. Direct/Chunked upload with abort signal
      const publicVideoUrl = await api.uploadFileToStorage(
        uploadData,
        selectedFile,
        (progress) => {
          setUploadProgress(15 + Math.round(progress * 0.7));
        },
        abortController.signal
      );

      setUploadProgress(90);

      if (abortController.signal.aborted) {
        throw new DOMException('Загрузка отменена пользователем', 'AbortError');
      }

      // 3. Combine caption and hashtags
      const fullCaption = `${title.trim()}\n\n${description.trim()}\n\n${hashtags.trim()}`.trim();

      // 4. Save task to Supabase DB
      await api.createPost({
        video_url: publicVideoUrl,
        caption: fullCaption,
        platforms,
        scheduled_at: publishNow ? new Date().toISOString() : new Date(scheduledAt).toISOString(),
        publish_now: publishNow,
      });

      setUploadProgress(100);
      setIsSuccess(true);
      hapticFeedback.success();
      onUploadSuccess();

      // Reset form
      handleClearFile();
      setTitle('');
      setDescription('');
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('отменена')) {
        setUploadError('Загрузка видео была отменена');
      } else {
        console.error('Upload flow error:', err);
        setUploadError(err.message || 'Ошибка загрузки видео');
        hapticFeedback.error();
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28 max-w-5xl mx-auto space-y-6">
      {/* Upload Success Banner */}
      {isSuccess && (
        <div className="p-4 rounded-2xl bg-[#17212B] border border-emerald-500/40 text-emerald-300 space-y-2 shadow-lg">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{publishNow ? 'Видео отправлено на публикацию!' : 'Видео успешно запланировано!'}</span>
          </div>
          <p className="text-xs text-[#708499]">
            {publishNow
              ? 'Ролик обрабатывается и публикуется в выбранные соцсети через Cron-воркер.'
              : `Публикация состоится: ${new Date(scheduledAt).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
          </p>
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false);
                onNavigateToCalendar();
              }}
              className="px-4 py-2 bg-[#3390EC] text-white text-xs font-semibold rounded-xl hover:bg-[#2B83D8] transition active:scale-95"
            >
              Перейти в Календарь
            </button>
            <button
              type="button"
              onClick={() => setIsSuccess(false)}
              className="px-4 py-2 bg-[#242F3D] hover:bg-[#2B3A4A] border border-[#2B3A4A] text-white text-xs font-medium rounded-xl transition"
            >
              Загрузить ещё
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Responsive 2-column on desktop, single column on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dropzone & Presets */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Video Dropzone */}
          <div className="space-y-2 flex-1 flex flex-col">
            <label className="text-xs font-semibold text-[#708499] uppercase tracking-wider flex items-center justify-between">
              <span>1. Видеоролик (9:16)</span>
              <span className="text-[11px] font-normal text-[#708499]">MP4, MOV</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
              className="hidden"
              onChange={handleFileChange}
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-[220px] bg-[#17212B] border-2 border-dashed border-[#2B3A4A] hover:border-[#3390EC] rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group relative"
              >
                <div className="w-16 h-16 bg-[#242F3D] group-hover:bg-[#3390EC] rounded-full flex items-center justify-center mb-3 transition-colors shadow-inner">
                  <UploadCloud className="w-8 h-8 text-[#708499] group-hover:text-white transition-colors" />
                </div>
                <p className="text-sm font-semibold text-white group-hover:text-[#3390EC] transition-colors">
                  Drop MP4 or MOV here
                </p>
                <p className="text-xs text-[#708499] mt-1">
                  Max 60s • 9:16 vertical ratio only
                </p>
                <div className="flex gap-2 mt-4 text-[11px] text-[#708499]">
                  <span className="px-2.5 py-1 rounded-lg bg-[#242F3D] border border-[#2B3A4A]">⏱ ≤ 60s</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[#242F3D] border border-[#2B3A4A]">📐 9:16</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#17212B] border border-[#2B3A4A] rounded-2xl p-4 space-y-3">
                {/* File header with thumbnail & diagnostics */}
                <div className="flex items-start gap-3.5">
                  <div className="relative w-20 h-28 rounded-xl bg-black overflow-hidden flex-shrink-0 border border-[#2B3A4A] flex items-center justify-center shadow-md">
                    {validation?.thumbnailUrl ? (
                      <img
                        src={validation.thumbnailUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-6 h-6 text-[#708499] animate-pulse" />
                    )}
                    {validation && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">
                        {validation.duration}s
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-white truncate" title={selectedFile.name}>
                        {selectedFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="text-[#708499] hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Удалить файл"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {isValidating ? (
                      <div className="flex items-center gap-1.5 text-xs text-[#3390EC] mt-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Проверка HTML5 Video API...</span>
                      </div>
                    ) : validation ? (
                      <div className="space-y-1.5 mt-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-[#242F3D] border border-[#2B3A4A] text-white font-mono">
                            {validation.width} × {validation.height} ({validation.aspectRatio})
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#242F3D] border border-[#2B3A4A] text-[#708499]">
                            {validation.fileSizeFormatted}
                          </span>
                        </div>

                        {validation.isValid ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium pt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Формат 9:16 и тайминг проверены ✅</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-medium pt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                            <span>Не соответствует требованиям</span>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Change / Remove quick buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2 py-1 rounded-lg bg-[#242F3D] hover:bg-[#2B3A4A] text-[11px] text-cyan-300 border border-[#2B3A4A] flex items-center gap-1 transition cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Сменить видео</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[11px] text-rose-300 border border-rose-500/20 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Отменить выбор</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Validation Errors */}
                {validation && !validation.isValid && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Загрузка заблокирована:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-200/90">
                      {validation.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Presets Block */}
          <div className="bg-[#17212B] border border-[#2B3A4A] rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#708499] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#3390EC]" />
              <span>Quick Presets</span>
            </h3>
            {presets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-2 bg-[#242F3D] hover:bg-[#2B3A4A] text-xs text-white rounded-xl border border-[#2B3A4A] transition-all cursor-pointer active:scale-95 text-left"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#708499]">
                Пресеты позволяют в 1 клик подставлять заголовок, описание и теги.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Form Details & Publishing */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="bg-[#17212B] border border-[#2B3A4A] rounded-2xl p-6 sm:p-8 space-y-5">
            {/* Video Title */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-[#708499] uppercase tracking-wider">
                  Video Title
                </label>
                <span className="text-[11px] text-[#708499]">{title.length}/100</span>
              </div>
              <input
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter catchy title..."
                className="w-full bg-[#242F3D] border border-[#2B3A4A] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3390EC] transition"
              />
            </div>

            {/* Caption & Description */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-[#708499] uppercase tracking-wider">
                  Caption & Description
                </label>
                <span className="text-[11px] text-[#708499]">{description.length}/1000</span>
              </div>
              <textarea
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell your audience about this video..."
                className="w-full bg-[#242F3D] border border-[#2B3A4A] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#3390EC] resize-none transition"
              />
            </div>

            {/* Hashtags */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#708499] uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#3390EC]" />
                <span>Hashtags</span>
              </label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#shorts #tiktok #viral"
                className="w-full bg-[#242F3D] border border-[#2B3A4A] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#3390EC]"
              />
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {['#shorts', '#tiktok', '#тренды', '#рек', '#coding', '#fyp', '#viral'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addQuickTag(tag)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#242F3D] hover:bg-[#2B3A4A] text-slate-300 font-mono border border-[#2B3A4A] transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform & Scheduling Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {/* Publish To Platforms */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-[#708499] uppercase tracking-wider">
                  Publish To
                </label>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => togglePlatform('youtube')}
                    className={`flex-1 h-12 rounded-xl bg-[#242F3D] border-2 flex items-center justify-center gap-2 transition cursor-pointer ${
                      platforms.includes('youtube')
                        ? 'border-[#3390EC] text-white'
                        : 'border-[#2B3A4A] text-[#708499] opacity-60'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0"></span>
                    <span className="text-xs font-semibold">YouTube</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => togglePlatform('tiktok')}
                    className={`flex-1 h-12 rounded-xl bg-[#242F3D] border-2 flex items-center justify-center gap-2 transition cursor-pointer ${
                      platforms.includes('tiktok')
                        ? 'border-[#3390EC] text-white'
                        : 'border-[#2B3A4A] text-[#708499] opacity-60'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 bg-cyan-400 rounded-full flex-shrink-0"></span>
                    <span className="text-xs font-semibold">TikTok</span>
                  </button>
                </div>
              </div>

              {/* Scheduling Selector */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-[#708499] uppercase tracking-wider">
                  Scheduling
                </label>
                <div className="flex bg-[#242F3D] border border-[#2B3A4A] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setPublishNow(true);
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      publishNow
                        ? 'bg-[#17212B] text-white shadow-sm'
                        : 'text-[#708499] hover:text-white'
                    }`}
                  >
                    Immediate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setPublishNow(false);
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      !publishNow
                        ? 'bg-[#17212B] text-white shadow-sm'
                        : 'text-[#708499] hover:text-white'
                    }`}
                  >
                    Scheduled
                  </button>
                </div>
              </div>
            </div>

            {/* Scheduled Datetime Picker */}
            {!publishNow && (
              <div className="p-3.5 rounded-xl bg-[#242F3D] border border-[#2B3A4A] space-y-1.5">
                <label className="text-xs text-[#708499] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#3390EC]" />
                  <span>Дата и время автопостинга:</span>
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 rounded-lg bg-[#17212B] border border-[#2B3A4A] text-sm text-white outline-none focus:border-[#3390EC]"
                />
              </div>
            )}

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-2.5 pt-2 p-3.5 rounded-xl bg-[#17212B] border border-[#3390EC]/30">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#3390EC] font-medium flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Отправка видеоролика...</span>
                  </span>
                  <span className="font-mono text-white font-bold">{uploadProgress}%</span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-[#242F3D] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#3390EC] to-cyan-400 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-rose-500/30"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Отменить загрузку</span>
                  </button>
                </div>
              </div>
            )}

            {/* Upload Error Alert */}
            {uploadError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-rose-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Action Buttons: Submit / Cancel */}
            <div className="space-y-2 pt-2">
              {isUploading ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled
                    className="flex-1 h-14 rounded-xl font-bold text-sm bg-[#242F3D] border border-[#2B3A4A] text-white flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-[#3390EC]" />
                    <span>Загрузка ({uploadProgress}%)...</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="px-5 h-14 rounded-xl font-bold text-sm bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                  >
                    <XCircle className="w-5 h-5 text-rose-400" />
                    <span>Отмена</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={isValidating || (!!selectedFile && !validation?.isValid)}
                    className={`w-full h-14 rounded-xl font-bold text-base shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
                      isValidating || (!!selectedFile && !validation?.isValid)
                        ? 'bg-[#242F3D] border border-[#2B3A4A] text-[#708499] cursor-not-allowed opacity-60'
                        : 'bg-[#3390EC] hover:bg-[#2B83D8] text-white shadow-[#3390EC]/20'
                    }`}
                  >
                    {publishNow ? (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Publish Video Now</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-5 h-5" />
                        <span>Schedule Video</span>
                      </>
                    )}
                  </button>

                  {selectedFile && (
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="w-full py-2.5 rounded-xl bg-transparent hover:bg-[#242F3D]/60 text-[#708499] hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer border border-transparent hover:border-[#2B3A4A]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Сбросить выбранное видео и форму</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
