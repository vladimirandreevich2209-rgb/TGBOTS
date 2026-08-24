import { PagesFunction, Env } from '../../types';

export const onRequestPut: PagesFunction<Env, 'id'> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';
  const presetId = context.params.id as string;

  try {
    const body = (await context.request.json()) as any;
    const { title, text, hashtags } = body;

    if (context.env.DB) {
      await context.env.DB.prepare(
        'UPDATE presets SET title = COALESCE(?, title), text = COALESCE(?, text), hashtags = COALESCE(?, hashtags) WHERE id = ? AND (user_id = ? OR user_id = ?)'
      )
        .bind(title ?? null, text ?? null, hashtags ?? null, presetId, userId, 'dev_user')
        .run();

      const preset = await context.env.DB.prepare('SELECT * FROM presets WHERE id = ?')
        .bind(presetId)
        .first<any>();

      if (preset) {
        return new Response(JSON.stringify(preset), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
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

export const onRequestDelete: PagesFunction<Env, 'id'> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';
  const presetId = context.params.id as string;

  try {
    if (context.env.DB) {
      await context.env.DB.prepare('DELETE FROM presets WHERE id = ? AND (user_id = ? OR user_id = ?)')
        .bind(presetId, userId, 'dev_user')
        .run();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
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
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
};
