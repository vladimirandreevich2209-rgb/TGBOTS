import { Env, PagesFunction } from '../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const env = context.env as any;

  const mask = (val?: string) => {
    if (!val) return { exists: false, preview: 'none' };
    return {
      exists: true,
      length: val.length,
      preview: `${val.substring(0, 6)}...${val.substring(val.length - 4)}`,
    };
  };

  const info = {
    timestamp: new Date().toISOString(),
    GOOGLE_CLIENT_ID: mask(env.GOOGLE_CLIENT_ID),
    VITE_GOOGLE_CLIENT_ID: mask(env.VITE_GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: mask(env.GOOGLE_CLIENT_SECRET),
    TIKTOK_CLIENT_KEY: mask(env.TIKTOK_CLIENT_KEY),
    TIKTOK_CLIENT_SECRET: mask(env.TIKTOK_CLIENT_SECRET),
    TELEGRAM_BOT_TOKEN: mask(env.TELEGRAM_BOT_TOKEN),
    D1_DATABASE_BINDING: {
      exists: Boolean(env.DB),
      type: typeof env.DB,
    },
  };

  return new Response(JSON.stringify(info, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
