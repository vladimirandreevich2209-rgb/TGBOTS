import { PagesFunction, Env } from '../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';

  try {
    if (context.env.DB) {
      await context.env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS presets (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, text TEXT, hashtags TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
      ).run();

      const { results } = await context.env.DB.prepare(
        'SELECT * FROM presets WHERE user_id = ? OR user_id = ? ORDER BY created_at DESC'
      )
        .bind(userId, 'dev_user')
        .all<any>();

      return new Response(JSON.stringify({ presets: results || [] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ presets: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ presets: [] }), {
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
    const { title, text, hashtags } = body;
    const newId = 'pr-' + Math.random().toString(36).substring(2, 9);

    if (context.env.DB) {
      await context.env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS presets (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, text TEXT, hashtags TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
      ).run();

      await context.env.DB.prepare(
        'INSERT INTO presets (id, user_id, title, text, hashtags) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(newId, userId, title || 'Новый шаблон', text || '', hashtags || '')
        .run();
    }

    return new Response(
      JSON.stringify({
        id: newId,
        user_id: userId,
        title: title || 'Новый шаблон',
        text: text || '',
        hashtags: hashtags || '',
        created_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
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
