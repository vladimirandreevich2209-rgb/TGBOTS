import { VideoValidationResult } from '../types';

export interface VideoMetadataValidation extends VideoValidationResult {
  thumbnailUrl?: string;
  fileSizeFormatted: string;
}

export const validateVideoFile = (file: File): Promise<VideoMetadataValidation> => {
  return new Promise((resolve, reject) => {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'];
    const errors: string[] = [];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|m4v|webm)$/i)) {
      errors.push('Поддерживаются только форматы MP4, MOV или WebM');
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      // 1. Duration check (<= 60.5s with small float margin)
      const isDurationValid = duration <= 60.5;
      if (!isDurationValid) {
        errors.push(
          `Длительность ролика ${duration.toFixed(1)} сек превышает лимит 60 секунд для YouTube Shorts и TikTok.`
        );
      }

      // 2. Aspect Ratio check (vertical: height > width, ideal 9:16 = 0.5625)
      const isVertical = height > width;
      const ratioValue = width / height; // ~0.5625 for 9:16
      const isCloseTo916 = ratioValue >= 0.5 && ratioValue <= 0.65;

      if (!isVertical) {
        errors.push(
          `Видео горизонтальное (${width}x${height}). Для Shorts и TikTok требуется вертикальный формат 9:16.`
        );
      } else if (!isCloseTo916) {
        // Just a notice/warning if vertical but not strictly 9:16
        // We still allow standard vertical heights like 4:5 or 3:4 if vertical, but warn
      }

      // Generate a thumbnail frame
      video.currentTime = Math.min(1, duration / 2);
    };

    video.onseeked = () => {
      let thumbnailUrl = '';
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth, 360);
        canvas.height = Math.min(video.videoHeight, 640);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        }
      } catch (e) {
        console.warn('Could not generate thumbnail canvas:', e);
      }

      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      const isDurationValid = duration <= 60.5;
      const isVertical = height > width;
      const isValid = errors.length === 0 && isDurationValid && isVertical;

      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const divisor = gcd(width, height) || 1;
      const simplifiedRatio = `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;

      cleanup();

      resolve({
        isValid,
        duration: Math.round(duration * 10) / 10,
        width,
        height,
        aspectRatio: isVertical && Math.abs(width / height - 9 / 16) < 0.05 ? '9:16' : simplifiedRatio,
        isVertical,
        isDurationValid,
        errors,
        thumbnailUrl,
        fileSizeFormatted: formatBytes(file.size),
      });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Не удалось прочитать видеофайл. Проверьте кодек и целостность файла.'));
    };
  });
};
