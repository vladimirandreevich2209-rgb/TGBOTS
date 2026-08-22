interface Env {
  TIKTOK_CLIENT_KEY: string;
  APP_URL: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clientKey = context.env.TIKTOK_CLIENT_KEY;
  const appUrl = context.env.APP_URL || 'https://shortsmaster.pages.dev';
  
  // Скоупы, необходимые для загрузки и публикации роликов
  const scope = 'user.info.basic,video.upload,video.publish';
  const redirectUri = encodeURIComponent(`${appUrl}/auth/callback`);
  const state = Math.random().toString(36).substring(7);

  const tiktokAuthUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${encodeURIComponent(scope)}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;

  return new Response(JSON.stringify({ url: tiktokAuthUrl }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};