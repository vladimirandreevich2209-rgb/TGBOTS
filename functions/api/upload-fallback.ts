import { PagesFunction, Env } from '../types';

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const filePath = url.searchParams.get('path') || `video-${Date.now()}.mp4`;
    const publicUrl = `/api/videos/${encodeURIComponent(filePath)}`;

    return new Response(
      JSON.stringify({
        success: true,
        publicUrl,
        path: filePath,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Upload error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};
