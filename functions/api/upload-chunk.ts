import { PagesFunction, Env } from '../types';
import { initDatabase } from '../lib/db';

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

    const fileId = url.searchParams.get('fileId') || context.request.headers.get('x-file-id');
    const chunkIndexStr = url.searchParams.get('chunkIndex') || context.request.headers.get('x-chunk-index');
    const totalChunksStr = url.searchParams.get('totalChunks') || context.request.headers.get('x-total-chunks');
    const fileName = url.searchParams.get('fileName') || context.request.headers.get('x-file-name') || 'video.mp4';
    const fileSizeStr = url.searchParams.get('fileSize') || context.request.headers.get('x-file-size') || '0';
    const mimeType = context.request.headers.get('content-type') || 'video/mp4';

    if (!fileId || chunkIndexStr === null || totalChunksStr === null) {
      return new Response(
        JSON.stringify({ error: 'Missing required chunk parameters: fileId, chunkIndex, totalChunks' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    const totalChunks = parseInt(totalChunksStr, 10);
    const fileSize = parseInt(fileSizeStr, 10) || 0;
    const cleanFileId = fileId.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Read chunk bytes from body
    const chunkBuffer = await context.request.arrayBuffer();
    if (!chunkBuffer || chunkBuffer.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: 'Empty chunk data received' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const chunkBase64 = arrayBufferToBase64(chunkBuffer);

    if (context.env.DB) {
      await initDatabase(context.env.DB);

      // If it is the first chunk, clean any old remnants
      if (chunkIndex === 0) {
        await context.env.DB.prepare('DELETE FROM video_chunks WHERE file_id = ?').bind(cleanFileId).run().catch(() => {});
      }

      // Save chunk
      await context.env.DB.prepare(
        'INSERT OR REPLACE INTO video_chunks (file_id, chunk_index, data_base64) VALUES (?, ?, ?)'
      )
        .bind(cleanFileId, chunkIndex, chunkBase64)
        .run();

      // If final chunk, register file metadata
      if (chunkIndex === totalChunks - 1) {
        await context.env.DB.prepare(
          'INSERT OR REPLACE INTO video_files (id, user_id, file_name, mime_type, size_bytes, total_chunks) VALUES (?, ?, ?, ?, ?, ?)'
        )
          .bind(cleanFileId, userId, fileName, mimeType, fileSize || chunkBuffer.byteLength, totalChunks)
          .run()
          .catch(() => {});
      }
    }

    const publicUrl = `/api/videos/${encodeURIComponent(cleanFileId)}`;

    return new Response(
      JSON.stringify({
        success: true,
        fileId: cleanFileId,
        chunkIndex,
        totalChunks,
        publicUrl,
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
    console.error('Error handling chunk upload:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal chunk upload error' }),
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
