import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// In-memory SQLite/D1 mock store for local development / testing
interface Store {
  users: Map<string, { telegram_id: string; youtube_refresh_token?: string; tiktok_access_token?: string; updated_at?: string }>;
  presets: Array<{ id: string; user_id: string; title: string; text: string; hashtags: string; created_at: string }>;
  posts: Array<{
    id: string;
    user_id: string;
    video_url: string;
    caption: string;
    platforms: ('youtube' | 'tiktok')[];
    scheduled_at: string;
    status: 'scheduled' | 'publishing' | 'published' | 'failed';
    error_message?: string | null;
    published_ids?: { youtube_video_id?: string; tiktok_publish_id?: string };
    created_at: string;
    updated_at: string;
  }>;
  uploadedVideos: Map<string, { buffer: Buffer; contentType: string; name: string }>;
}

const db: Store = {
  users: new Map([
    [
      '12345678',
      {
        telegram_id: '12345678',
        youtube_refresh_token: 'mock_youtube_refresh_token',
        tiktok_access_token: 'mock_tiktok_access_token',
        updated_at: new Date().toISOString(),
      },
    ],
    [
      'dev_user',
      {
        telegram_id: 'dev_user',
        youtube_refresh_token: 'mock_youtube_refresh_token',
        tiktok_access_token: 'mock_tiktok_access_token',
        updated_at: new Date().toISOString(),
      },
    ],
  ]),
  presets: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      user_id: '12345678',
      title: '🔥 Трендовый Шортс',
      text: 'Смотри до конца! Ставь лайк и подписывайся на канал.',
      hashtags: '#shorts #tiktok #тренды #рек #топ #reels #viral',
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      user_id: '12345678',
      title: '💻 IT & Разработка лайфхак',
      text: 'Полезный совет для разработчиков и дизайнеров. Сохраняй, чтобы не потерять!',
      hashtags: '#coding #developer #it #programming #tips #webdev #технологии',
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      user_id: '12345678',
      title: '🚀 Мотивация и Продуктивность',
      text: 'Каждый день — это шаг к твоей главной цели. Не сдавайся!',
      hashtags: '#motivation #success #саморазвитие #бизнес #цели #дисциплина',
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
  ],
  posts: [
    {
      id: 'p-101',
      user_id: '12345678',
      video_url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-neon-lights-in-the-city-41559-large.mp4',
      caption: 'Ночной киберпанк город 🌆 Невероятные неоновые огни и атмосфера #shorts #tiktok #cyberpunk #neon',
      platforms: ['youtube', 'tiktok'],
      scheduled_at: new Date(Date.now() + 3600000 * 2).toISOString(),
      status: 'scheduled',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'p-102',
      user_id: '12345678',
      video_url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-video-of-a-woman-coding-on-a-laptop-42998-large.mp4',
      caption: 'Топ 3 полезных расширения для VS Code в 2026 году! Сохраняй 💻 #coding #developer #shorts',
      platforms: ['youtube'],
      scheduled_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      status: 'published',
      published_ids: { youtube_video_id: 'xV8qK92a' },
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ],
  uploadedVideos: new Map(),
};

// Helper: Extract user id from request headers or query
const getTelegramUserId = (req: express.Request): string => {
  const headerId = req.headers['x-telegram-user-id'];
  if (headerId && typeof headerId === 'string' && headerId.trim() !== '') {
    return headerId.trim();
  }
  const queryId = req.query.telegram_id;
  if (queryId && typeof queryId === 'string' && queryId.trim() !== '') {
    return queryId.trim();
  }
  return 'dev_user';
};

// ==========================================
// 1. API: Cloudflare D1 User Status
// ==========================================
app.get('/api/user/status', (req, res) => {
  const telegramId = (req.query.telegram_id as string) || getTelegramUserId(req);
  const user = db.users.get(telegramId) || db.users.get('dev_user') || db.users.get('12345678');

  const hasYouTube = Boolean(user && user.youtube_refresh_token);
  const hasTikTok = Boolean(user && user.tiktok_access_token);

  res.json({
    hasYouTube,
    hasTikTok,
  });
});

app.post('/api/user/disconnect', (req, res) => {
  const telegramId = (req.query.telegram_id as string) || getTelegramUserId(req);
  const platform = req.query.platform as string;

  const user = db.users.get(telegramId);
  if (user) {
    if (platform === 'youtube') user.youtube_refresh_token = undefined;
    if (platform === 'tiktok') user.tiktok_access_token = undefined;
    user.updated_at = new Date().toISOString();
  }

  res.json({ success: true });
});

// ==========================================
// 2. API: TikTok OAuth URL Generator
// ==========================================
app.get('/api/tiktok/url', (req, res) => {
  const telegramId = (req.query.telegram_id as string) || getTelegramUserId(req);
  const clientKey = process.env.TIKTOK_CLIENT_KEY || 'awq89samplekey';
  const appOrigin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${appOrigin}/api/tiktok/callback`;
  const scopes = 'user.info.basic,user.info.profile,video.upload,video.list';

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: scopes,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: telegramId,
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  res.json({ url: authUrl });
});

// TikTok Callback
app.get(['/api/tiktok/callback', '/api/tiktok/callback/'], async (req, res) => {
  try {
    const { code, state } = req.query;
    const telegramId = (state as string) || 'dev_user';

    let user = db.users.get(telegramId);
    if (!user) {
      user = { telegram_id: telegramId };
      db.users.set(telegramId, user);
    }
    user.tiktok_access_token = 'tt_token_' + Date.now();
    user.updated_at = new Date().toISOString();

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TikTok Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #17212B; color: #fff; text-align: center; padding: 40px 20px; }
            .card { max-width: 400px; margin: 0 auto; background: #242F3D; padding: 24px; border-radius: 16px; }
            h2 { color: #22d3ee; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✓ TikTok подключен!</h2>
            <p>Токен успешно сохранен в D1.</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', platform: 'tiktok' }, '*');
              setTimeout(() => window.close(), 1200);
            } else {
              setTimeout(() => { window.location.href = '/'; }, 1500);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`Ошибка: ${err.message}`);
  }
});

// YouTube Callback
app.get(['/api/youtube/callback', '/api/youtube/callback/'], async (req, res) => {
  try {
    const { code, state } = req.query;
    const telegramId = (state as string) || 'dev_user';

    let user = db.users.get(telegramId);
    if (!user) {
      user = { telegram_id: telegramId };
      db.users.set(telegramId, user);
    }
    user.youtube_refresh_token = 'yt_refresh_' + Date.now();
    user.updated_at = new Date().toISOString();

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>YouTube Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #17212B; color: #fff; text-align: center; padding: 40px 20px; }
            .card { max-width: 400px; margin: 0 auto; background: #242F3D; padding: 24px; border-radius: 16px; }
            h2 { color: #4ade80; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✓ YouTube Shorts подключен!</h2>
            <p>Refresh token успешно сохранен в D1.</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', platform: 'youtube' }, '*');
              setTimeout(() => window.close(), 1200);
            } else {
              setTimeout(() => { window.location.href = '/'; }, 1500);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send(`Ошибка: ${err.message}`);
  }
});

// ==========================================
// 3. API: Status & Integrations
// ==========================================
app.get('/api/integrations/status', (req, res) => {
  const telegramId = getTelegramUserId(req);
  const user = db.users.get(telegramId) || db.users.get('dev_user') || db.users.get('12345678');

  res.json({
    youtube: {
      connected: Boolean(user?.youtube_refresh_token),
      channel_title: 'Shorts Channel',
    },
    tiktok: {
      connected: Boolean(user?.tiktok_access_token),
      display_name: '@creator',
    },
    d1: {
      configured: true,
      database: 'shortsmaster-db',
    },
  });
});

app.post('/api/integrations/disconnect/:platform', (req, res) => {
  const telegramId = getTelegramUserId(req);
  const { platform } = req.params;
  const user = db.users.get(telegramId);
  if (user) {
    if (platform === 'youtube') user.youtube_refresh_token = undefined;
    if (platform === 'tiktok') user.tiktok_access_token = undefined;
  }
  res.json({ success: true });
});

// ==========================================
// 4. API: Storage Upload URL Generator & Uploads
// ==========================================
app.post('/api/get-upload-url', async (req, res) => {
  try {
    const userId = getTelegramUserId(req);
    const { fileName } = req.body;
    const cleanFileName = `${userId}-${Date.now()}-${(fileName || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    return res.json({
      uploadUrl: `/api/upload-fallback?path=${encodeURIComponent(cleanFileName)}`,
      publicUrl: `/api/videos/${encodeURIComponent(cleanFileName)}`,
      path: cleanFileName,
      directUpload: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

app.post('/api/upload-fallback', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  try {
    const filePath = (req.query.path as string) || `video-${Date.now()}.mp4`;
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

    db.uploadedVideos.set(filePath, {
      buffer,
      contentType: req.headers['content-type'] || 'video/mp4',
      name: filePath,
    });

    const publicUrl = `/api/videos/${encodeURIComponent(filePath)}`;
    res.json({ success: true, publicUrl, path: filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/videos/:fileName', (req, res) => {
  const fileName = decodeURIComponent(req.params.fileName);
  const video = db.uploadedVideos.get(fileName);
  if (video) {
    res.setHeader('Content-Type', video.contentType);
    res.setHeader('Content-Length', video.buffer.length);
    return res.send(video.buffer);
  }
  res.redirect('https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-neon-lights-in-the-city-41559-large.mp4');
});

// ==========================================
// 5. API: Posts CRUD
// ==========================================
app.get('/api/posts', (req, res) => {
  const userId = getTelegramUserId(req);
  const posts = db.posts.filter((p) => p.user_id === userId || userId === 'dev_user');
  posts.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  res.json({ posts });
});

app.post('/api/posts', (req, res) => {
  try {
    const userId = getTelegramUserId(req);
    const { video_url, caption, platforms, scheduled_at, publish_now } = req.body;

    if (!video_url) {
      return res.status(400).json({ error: 'Ссылка на видео обязательна' });
    }

    const scheduledDate = publish_now ? new Date().toISOString() : (scheduled_at || new Date().toISOString());
    const initialStatus = publish_now ? 'published' : 'scheduled';

    const newPost = {
      id: 'p-' + Math.random().toString(36).substring(2, 9),
      user_id: userId,
      video_url,
      caption: caption || '',
      platforms: Array.isArray(platforms) && platforms.length > 0 ? platforms : (['youtube', 'tiktok'] as any),
      scheduled_at: scheduledDate,
      status: initialStatus as any,
      error_message: null,
      published_ids: publish_now ? { youtube_video_id: 'yt_sample', tiktok_publish_id: 'tt_sample' } : {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.posts.unshift(newPost);
    res.json(newPost);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/posts/:id', (req, res) => {
  const userId = getTelegramUserId(req);
  const { id } = req.params;
  db.posts = db.posts.filter((p) => !(p.id === id && (p.user_id === userId || userId === 'dev_user')));
  res.json({ success: true });
});

app.post('/api/posts/:id/retry', (req, res) => {
  const userId = getTelegramUserId(req);
  const { id } = req.params;
  const post = db.posts.find((p) => p.id === id && (p.user_id === userId || userId === 'dev_user'));
  if (post) {
    post.status = 'published';
    post.error_message = null;
    return res.json(post);
  }
  res.status(404).json({ error: 'Пост не найден' });
});

// ==========================================
// 6. API: Presets CRUD
// ==========================================
app.get('/api/presets', (req, res) => {
  const userId = getTelegramUserId(req);
  const presets = db.presets.filter((p) => p.user_id === userId || userId === 'dev_user');
  res.json({ presets });
});

app.post('/api/presets', (req, res) => {
  const userId = getTelegramUserId(req);
  const { title, text, hashtags } = req.body;

  const newPreset = {
    id: 'pr-' + Math.random().toString(36).substring(2, 9),
    user_id: userId,
    title: title || 'Новый шаблон',
    text: text || '',
    hashtags: hashtags || '',
    created_at: new Date().toISOString(),
  };

  db.presets.unshift(newPreset);
  res.json(newPreset);
});

app.put('/api/presets/:id', (req, res) => {
  const userId = getTelegramUserId(req);
  const { id } = req.params;
  const { title, text, hashtags } = req.body;

  const preset = db.presets.find((p) => p.id === id && (p.user_id === userId || userId === 'dev_user'));
  if (preset) {
    if (title !== undefined) preset.title = title;
    if (text !== undefined) preset.text = text;
    if (hashtags !== undefined) preset.hashtags = hashtags;
    return res.json(preset);
  }

  res.status(404).json({ error: 'Пресет не найден' });
});

app.delete('/api/presets/:id', (req, res) => {
  const userId = getTelegramUserId(req);
  const { id } = req.params;
  db.presets = db.presets.filter((p) => !(p.id === id && (p.user_id === userId || userId === 'dev_user')));
  res.json({ success: true });
});

app.post('/api/publish-cron', (req, res) => {
  res.json({ success: true, processed: 0, timestamp: new Date().toISOString() });
});

// ==========================================
// Vite Dev & Static Assets Serving
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Telegram Mini App Server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VERCEL !== '1' && process.env.NETLIFY !== 'true' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}

export default app;
