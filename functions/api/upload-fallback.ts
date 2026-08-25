import { PagesFunction, Env } from '../types';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

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
    const headerId = context.request.headers.get('x-telegram-user-id');
    const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';

    const filePath = url.searchParams.get('path') || `video-${Date.now()}.mp4`;
    const cleanId = filePath.replace(/[^a-zA-Z0-9._-]/g, '_');
    const publicUrl = `/api/videos/${encodeURIComponent(cleanId)}`;

    let videoBytes: ArrayBuffer | null = null;
    let mimeType = 'video/mp4';

    // Handle Multipart FormData or Direct Binary stream
    const contentType = context.request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await context.request.formData();
        const file = formData.get('video') as File | null;
        if (file) {
          videoBytes = await file.arrayBuffer();
          mimeType = file.type || 'video/mp4';
        }
      } catch (err) {
        console.warn('FormData parse error, trying raw body:', err);
      }
    }

    if (!videoBytes) {
      try {
        videoBytes = await context.request.arrayBuffer();
      } catch (e) {
        console.warn('Raw body read error:', e);
      }
    }

    if (context.env.DB && videoBytes && videoBytes.byteLength > 0) {
      try {
        const totalSize = videoBytes.byteLength;
        const CHUNK_SIZE = 120000; // ~120KB binary chunks, perfectly safe for D1 parameters
        const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

        await context.env.DB.prepare(
          'CREATE TABLE IF NOT EXISTS video_files (id TEXT PRIMARY KEY, user_id TEXT, file_name TEXT, mime_type TEXT, size_bytes INTEGER, total_chunks INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
        ).run();

        await context.env.DB.prepare(
          'CREATE TABLE IF NOT EXISTS video_chunks (file_id TEXT, chunk_index INTEGER, data_base64 TEXT, PRIMARY KEY(file_id, chunk_index))'
        ).run();

        // Clear existing chunks for this file if any
        await context.env.DB.prepare('DELETE FROM video_chunks WHERE file_id = ?').bind(cleanId).run();

        // Save chunks
        const u8 = new Uint8Array(videoBytes);
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, totalSize);
          const chunkBytes = u8.slice(start, end);
          const chunkB64 = arrayBufferToBase64(chunkBytes.buffer);

          await context.env.DB.prepare(
            'INSERT OR REPLACE INTO video_chunks (file_id, chunk_index, data_base64) VALUES (?, ?, ?)'
          )
            .bind(cleanId, i, chunkB64)
            .run();
        }

        // Save file meta
        await context.env.DB.prepare(
          'INSERT OR REPLACE INTO video_files (id, user_id, file_name, mime_type, size_bytes, total_chunks) VALUES (?, ?, ?, ?, ?, ?)'
        )
          .bind(cleanId, userId, filePath, mimeType, totalSize, totalChunks)
          .run();
      } catch (dbErr) {
        console.warn('Could not store chunks into D1:', dbErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        publicUrl,
        path: cleanId,
        size: videoBytes ? videoBytes.byteLength : 0,
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

