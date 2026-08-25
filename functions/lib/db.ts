export async function initDatabase(db: any) {
  if (!db) return;

  try {
    // 1. Create base users table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id TEXT PRIMARY KEY,
        youtube_refresh_token TEXT,
        tiktok_access_token TEXT,
        tiktok_refresh_token TEXT,
        tiktok_open_id TEXT,
        tiktok_scope TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});

    // 2. Safe migrations for existing users table
    const userColumns = [
      'tiktok_refresh_token TEXT',
      'tiktok_open_id TEXT',
      'tiktok_scope TEXT'
    ];
    for (const col of userColumns) {
      await db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run().catch(() => {});
    }

    // 3. Create posts table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        video_url TEXT,
        caption TEXT,
        platforms TEXT,
        scheduled_at TEXT,
        status TEXT,
        error_message TEXT,
        published_ids TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});

    // 4. Create video_chunks table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS video_chunks (
        file_id TEXT,
        chunk_index INTEGER,
        data_base64 TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (file_id, chunk_index)
      )
    `).run().catch(() => {});

    // 5. Create video_files table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS video_files (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        file_name TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        total_chunks INTEGER,
        data_base64 TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});

    const fileColumns = [
      'user_id TEXT',
      'mime_type TEXT',
      'total_chunks INTEGER'
    ];
    for (const col of fileColumns) {
      await db.prepare(`ALTER TABLE video_files ADD COLUMN ${col}`).run().catch(() => {});
    }
  } catch (err) {
    console.warn('initDatabase migration notice:', err);
  }
}
