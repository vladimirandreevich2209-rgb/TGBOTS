import { PagesFunction, Env } from '../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';

  try {
    if (context.env.DB) {
      await context.env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, user_id TEXT, video_url TEXT, caption TEXT, platforms TEXT, scheduled_at TEXT, status TEXT, error_message TEXT, published_ids TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
      ).run();

      const { results } = await context.env.DB.prepare(
        'SELECT * FROM posts WHERE user_id = ? OR user_id = ? ORDER BY scheduled_at DESC'
      )
        .bind(userId, 'dev_user')
        .all<any>();

      const posts = (results || []).map((row) => ({
        ...row,
        platforms: row.platforms ? JSON.parse(row.platforms) : ['youtube', 'tiktok'],
        published_ids: row.published_ids ? JSON.parse(row.published_ids) : {},
      }));

      return new Response(JSON.stringify({ posts }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ posts: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, posts: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';

  try {
    const body = (await context.request.json()) as any;
    const { video_url, caption, platforms, scheduled_at, publish_now } = body;

    if (!video_url) {
      return new Response(JSON.stringify({ error: 'Ссылка на видео обязательна' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const scheduledDate = publish_now ? new Date().toISOString() : (scheduled_at || new Date().toISOString());
    const initialStatus = publish_now ? 'published' : 'scheduled';
    const newId = 'p-' + Math.random().toString(36).substring(2, 9);
    const platformsStr = JSON.stringify(Array.isArray(platforms) ? platforms : ['youtube', 'tiktok']);
    const publishedIdsStr = publish_now
      ? JSON.stringify({ youtube_video_id: 'yt_' + Date.now(), tiktok_publish_id: 'tt_' + Date.now() })
      : JSON.stringify({});

    if (context.env.DB) {
      await context.env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, user_id TEXT, video_url TEXT, caption TEXT, platforms TEXT, scheduled_at TEXT, status TEXT, error_message TEXT, published_ids TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
      ).run();

      await context.env.DB.prepare(
        'INSERT INTO posts (id, user_id, video_url, caption, platforms, scheduled_at, status, published_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          newId,
          userId,
          video_url,
          caption || '',
          platformsStr,
          scheduledDate,
          initialStatus,
          publishedIdsStr
        )
        .run();
    }

    const newPost = {
      id: newId,
      user_id: userId,
      video_url,
      caption: caption || '',
      platforms: Array.isArray(platforms) ? platforms : ['youtube', 'tiktok'],
      scheduled_at: scheduledDate,
      status: initialStatus,
      error_message: null,
      published_ids: publish_now ? { youtube_video_id: 'yt_ok', tiktok_publish_id: 'tt_ok' } : {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(newPost), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Create post error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
};
