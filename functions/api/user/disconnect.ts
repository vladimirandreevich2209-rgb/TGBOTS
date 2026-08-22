import { Env, PagesFunction } from '../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const telegramId = url.searchParams.get('telegram_id');
  const platform = url.searchParams.get('platform'); // 'youtube' | 'tiktok'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-telegram-user-id',
    'Content-Type': 'application/json',
  };

  if (!telegramId || !platform) {
    return new Response(JSON.stringify({ error: 'Missing telegram_id or platform' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    if (context.env.DB) {
      if (platform === 'youtube') {
        await context.env.DB.prepare(
          'UPDATE users SET youtube_refresh_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?'
        )
          .bind(telegramId)
          .run();
      } else if (platform === 'tiktok') {
        await context.env.DB.prepare(
          'UPDATE users SET tiktok_access_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?'
        )
          .bind(telegramId)
          .run();
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-telegram-user-id',
    },
  });
};
