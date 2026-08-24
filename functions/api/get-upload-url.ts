import { PagesFunction, Env } from '../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const headerId = context.request.headers.get('x-telegram-user-id');
    const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';

    let body: any = {};
    try {
      body = await context.request.json();
    } catch {
      body = {};
    }

    const fileName = body.fileName || 'video.mp4';
    const cleanFileName = `${userId}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    return new Response(
      JSON.stringify({
        uploadUrl: `/api/upload-fallback?path=${encodeURIComponent(cleanFileName)}`,
        publicUrl: `/api/videos/${encodeURIComponent(cleanFileName)}`,
        path: cleanFileName,
        directUpload: false,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
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
