import { PagesFunction, Env } from '../../types';

function safeBase64ToUint8Array(base64: string): Uint8Array | null {
  try {
    if (!base64 || typeof base64 !== 'string') return null;
    let clean = base64.replace(/[^A-Za-z0-9+/=]/g, '').trim();
    while (clean.length % 4 !== 0) {
      clean += '=';
    }
    const binaryString = atob(clean);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env, 'fileName'> = async (context) => {
  const rawFileName = decodeURIComponent(context.params.fileName as string);
  const cleanId = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (context.env.DB) {
    try {
      // 1. Try reading from video_chunks
      const chunkRows = await context.env.DB.prepare(
        'SELECT data_base64 FROM video_chunks WHERE file_id = ? OR file_id = ? ORDER BY chunk_index ASC'
      )
        .bind(cleanId, rawFileName)
        .all<{ data_base64: string }>();

      if (chunkRows.results && chunkRows.results.length > 0) {
        const parts: Uint8Array[] = [];
        let totalLen = 0;
        for (const row of chunkRows.results) {
          const b = safeBase64ToUint8Array(row.data_base64);
          if (b) {
            parts.push(b);
            totalLen += b.byteLength;
          }
        }
        const fullBytes = new Uint8Array(totalLen);
        let offset = 0;
        for (const part of parts) {
          fullBytes.set(part, offset);
          offset += part.byteLength;
        }

        return new Response(fullBytes, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(fullBytes.byteLength),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 2. Legacy fallback from video_files
      const fileRow = await context.env.DB.prepare(
        'SELECT * FROM video_files WHERE id = ? OR file_name = ?'
      )
        .bind(cleanId, rawFileName)
        .first<any>();

      if (fileRow && fileRow.data_base64) {
        const bytes = safeBase64ToUint8Array(fileRow.data_base64);
        if (bytes) {
          return new Response(bytes, {
            status: 200,
            headers: {
              'Content-Type': fileRow.mime_type || 'video/mp4',
              'Content-Length': String(bytes.byteLength),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }
    } catch (e) {
      console.error('Error fetching video from D1:', e);
    }
  }

  // Fallback vertical sample
  return Response.redirect(
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    302
  );
};

