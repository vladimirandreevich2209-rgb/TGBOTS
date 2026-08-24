import { PagesFunction, Env } from '../types';
import { executeRealPublish } from '../lib/publisher';

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
    const newId = 'p-' + Math.random().toString(36).substring(2, 9);
    const platformsArr = Array.isArray(platforms) ? platforms : ['youtube', 'tiktok'];
    const platformsStr = JSON.stringify(platformsArr);

    let initialStatus = publish_now ? 'publishing' : 'scheduled';
    let errorMessage: string | null = null;
    let publishedIdsObj: Record<string, any> = {};

    if (publish_now) {
      const pubResult = await executeRealPublish(context.env, userId, {
        id: newId,
        video_url,
        caption: caption || '',
        platforms: platformsArr,
      });

      let hasSuccess = false;
      const errors: string[] = [];

      if (pubResult.youtube) {
        if (pubResult.youtube.success && pubResult.youtube.videoId) {
          publishedIdsObj.youtube_video_id = pubResult.youtube.videoId;
          hasSuccess = true;
        } else if (pubResult.youtube.error) {
          errors.push(`YouTube: ${pubResult.youtube.error}`);
        }
      }

      if (pubResult.tiktok) {
        if (pubResult.tiktok.success && pubResult.tiktok.publishId) {
          publishedIdsObj.tiktok_publish_id = pubResult.tiktok.publishId;
          hasSuccess = true;
        } else if (pubResult.tiktok.error) {
          errors.push(`TikTok: ${pubResult.tiktok.error}`);
        }
      }

      if (hasSuccess) {
        initialStatus = 'published';
      } else if (errors.length > 0) {
        initialStatus = 'failed';
        errorMessage = errors.join('; ');
      } else {
        initialStatus = 'published';
      }
    }

    const publishedIdsStr = JSON.stringify(publishedIdsObj);

    if (context.env.DB) {
      await context.env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, user_id TEXT, video_url TEXT, caption TEXT, platforms TEXT, scheduled_at TEXT, status TEXT, error_message TEXT, published_ids TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
      ).run();

      await context.env.DB.prepare(
        'INSERT INTO posts (id, user_id, video_url, caption, platforms, scheduled_at, status, error_message, published_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          newId,
          userId,
          video_url,
          caption || '',
          platformsStr,
          scheduledDate,
          initialStatus,
          errorMessage,
          publishedIdsStr
        )
        .run();
    }

    const newPost = {
      id: newId,
      user_id: userId,
      video_url,
      caption: caption || '',
      platforms: platformsArr,
      scheduled_at: scheduledDate,
      status: initialStatus,
      error_message: errorMessage,
      published_ids: publishedIdsObj,
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
