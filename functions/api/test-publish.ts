import { Env, PagesFunction } from '../types';
import { executeRealPublish } from '../lib/publisher';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId || url.searchParams.get('telegram_id') || '740180583';

  try {
    const pubResult = await executeRealPublish(context.env, userId, {
      id: 'test-' + Date.now(),
      video_url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-neon-lights-in-the-city-41559-large.mp4',
      caption: 'Test publish from ShortMaster #shorts #tiktok',
      platforms: ['youtube', 'tiktok'],
    });

    return new Response(JSON.stringify(pubResult, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return onRequestPost(context);
};
