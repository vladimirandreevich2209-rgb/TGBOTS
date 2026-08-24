import { Env, PagesFunction } from '../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const headerId = context.request.headers.get('x-telegram-user-id');
  const telegramId = url.searchParams.get('telegram_id') || headerId || 'dev_user';

  const env = context.env as any;

  const mask = (val?: string) => {
    if (!val) return { exists: false };
    return {
      exists: true,
      length: val.length,
      preview: `${val.substring(0, 6)}...${val.substring(val.length - 4)}`,
    };
  };

  let dbStatus: any = {
    connected: false,
    usersCount: 0,
    postsCount: 0,
    users: [],
    posts: [],
    error: null,
  };

  if (context.env.DB) {
    try {
      // Check users table
      await context.env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS users (telegram_id TEXT PRIMARY KEY, youtube_refresh_token TEXT, tiktok_access_token TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
      ).run();

      const { results: users } = await context.env.DB.prepare('SELECT * FROM users').all<any>();
      dbStatus.usersCount = users?.length || 0;
      dbStatus.users = (users || []).map((u) => ({
        telegram_id: u.telegram_id,
        hasYouTube: Boolean(u.youtube_refresh_token),
        hasTikTok: Boolean(u.tiktok_access_token),
        updated_at: u.updated_at,
      }));

      // Check posts table
      await context.env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, user_id TEXT, video_url TEXT, caption TEXT, platforms TEXT, scheduled_at TEXT, status TEXT, error_message TEXT, published_ids TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
      ).run();

      const { results: posts } = await context.env.DB.prepare(
        'SELECT * FROM posts ORDER BY created_at DESC LIMIT 10'
      ).all<any>();
      dbStatus.postsCount = posts?.length || 0;
      dbStatus.posts = posts || [];
      dbStatus.connected = true;
    } catch (e: any) {
      dbStatus.error = e.message;
    }
  }

  const responseData = {
    timestamp: new Date().toISOString(),
    environment_variables: {
      GOOGLE_CLIENT_ID: mask(env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: mask(env.GOOGLE_CLIENT_SECRET),
      TIKTOK_CLIENT_KEY: mask(env.TIKTOK_CLIENT_KEY),
      TIKTOK_CLIENT_SECRET: mask(env.TIKTOK_CLIENT_SECRET),
      TELEGRAM_BOT_TOKEN: mask(env.TELEGRAM_BOT_TOKEN),
    },
    database_d1: {
      binding_name: 'DB',
      binding_exists: Boolean(context.env.DB),
      ...dbStatus,
    },
  };

  return new Response(JSON.stringify(responseData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
