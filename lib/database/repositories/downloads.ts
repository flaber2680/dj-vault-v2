import type Database from "better-sqlite3";
import { getRuntimeDatabase } from "../client.ts";

export type DownloadEventRecord = {
  downloadedAt: string;
  ipAddress: string;
  userAgent: string;
};

export type DownloadRecord = {
  userId: string;
  archiveId: string;
  downloadCount: number;
  downloadedAt?: string;
  events: DownloadEventRecord[];
  updatedAt: string;
};

type DownloadRecordRow = {
  user_id: string;
  archive_id: string;
  download_count: number;
  downloaded_at: string | null;
  updated_at: string;
};

type DownloadEventRow = {
  downloaded_at: string;
  ip_address: string;
  user_agent: string;
};

function mapDownloadRecord(
  db: Database.Database,
  row: DownloadRecordRow,
): DownloadRecord {
  const events = db.prepare(`
    SELECT downloaded_at, ip_address, user_agent
    FROM download_events
    WHERE user_id = ? AND archive_id = ?
    ORDER BY id
  `).all(row.user_id, row.archive_id) as DownloadEventRow[];

  return {
    userId: row.user_id,
    archiveId: row.archive_id,
    downloadCount: row.download_count,
    downloadedAt: row.downloaded_at ?? undefined,
    events: events.map((event) => ({
      downloadedAt: event.downloaded_at,
      ipAddress: event.ip_address,
      userAgent: event.user_agent,
    })),
    updatedAt: row.updated_at,
  };
}

function getRecordRow(
  db: Database.Database,
  userId: string,
  archiveId: string,
): DownloadRecordRow | undefined {
  return db.prepare(`
    SELECT * FROM download_records WHERE user_id = ? AND archive_id = ?
  `).get(userId, archiveId) as DownloadRecordRow | undefined;
}

export function getDownloadRecords(): DownloadRecord[] {
  const db = getRuntimeDatabase();
  const rows = db.prepare("SELECT * FROM download_records").all() as DownloadRecordRow[];
  return rows.map((row) => mapDownloadRecord(db, row));
}

export function getDownloadRecord(userId: string, archiveId: string): DownloadRecord | null {
  const db = getRuntimeDatabase();
  const row = getRecordRow(db, userId, archiveId);
  return row ? mapDownloadRecord(db, row) : null;
}

export function registerDownloadAttempt({
  archiveId,
  ipAddress,
  limit,
  userAgent,
  userId,
}: {
  archiveId: string;
  ipAddress: string;
  limit: number;
  userAgent: string;
  userId: string;
}): { allowed: boolean; record: DownloadRecord } {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const existing = getRecordRow(db, userId, archiveId);
    if (existing && existing.download_count >= limit) {
      return { allowed: false, record: mapDownloadRecord(db, existing) };
    }

    const now = new Date().toISOString();
    if (!existing) {
      db.prepare(`
        INSERT INTO download_records (
          user_id, archive_id, download_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(userId, archiveId, 0, now, now);
    }

    db.prepare(`
      UPDATE download_records
      SET download_count = download_count + 1, downloaded_at = ?, updated_at = ?
      WHERE user_id = ? AND archive_id = ?
    `).run(now, now, userId, archiveId);
    db.prepare(`
      INSERT INTO download_events (user_id, archive_id, downloaded_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, archiveId, now, ipAddress, userAgent);

    return {
      allowed: true,
      record: mapDownloadRecord(db, getRecordRow(db, userId, archiveId)!),
    };
  });

  return run.immediate();
}

export function resetDownloadLimit(userId: string, archiveId: string): void {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    db.prepare("DELETE FROM download_events WHERE user_id = ? AND archive_id = ?").run(
      userId,
      archiveId,
    );
    db.prepare("DELETE FROM download_records WHERE user_id = ? AND archive_id = ?").run(
      userId,
      archiveId,
    );
  });

  run.immediate();
}
