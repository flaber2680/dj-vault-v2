import type Database from "better-sqlite3";
import { getRuntimeDatabase } from "../client.ts";

export type CollectionRecord = {
  number: string;
  date: string;
  size: string;
  sizeBytes?: number;
  genres: string;
  description: string;
  tracks: string;
  s3Key?: string;
  legacyDownloadUrl?: string;
  isActive: boolean;
  downloadLimit: number;
};

type CollectionRow = {
  number: string;
  date: string;
  size: string;
  size_bytes: number | null;
  genres: string;
  description: string;
  tracks: string;
  s3_key: string | null;
  legacy_download_url: string | null;
  is_active: number;
  download_limit: number;
};

function mapCollection(row: CollectionRow): CollectionRecord {
  return {
    number: row.number,
    date: row.date,
    size: row.size,
    sizeBytes: row.size_bytes ?? undefined,
    genres: row.genres,
    description: row.description,
    tracks: row.tracks,
    s3Key: row.s3_key ?? undefined,
    legacyDownloadUrl: row.legacy_download_url ?? undefined,
    isActive: Boolean(row.is_active),
    downloadLimit: row.download_limit,
  };
}

function getCollectionRow(db: Database.Database, number: string): CollectionRow | undefined {
  return db.prepare("SELECT * FROM collections WHERE number = ?").get(number) as CollectionRow | undefined;
}

export function getCollectionRecords(): CollectionRecord[] {
  return (getRuntimeDatabase().prepare("SELECT * FROM collections").all() as CollectionRow[]).map(mapCollection);
}

export function findCollectionRecord(number: string): CollectionRecord | null {
  const row = getCollectionRow(getRuntimeDatabase(), number);
  return row ? mapCollection(row) : null;
}

export function saveCollectionRecord(input: CollectionRecord): CollectionRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO collections (
        number, date, size, size_bytes, genres, description, tracks, s3_key,
        legacy_download_url, is_active, download_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(number) DO UPDATE SET
        date = excluded.date,
        size = excluded.size,
        size_bytes = excluded.size_bytes,
        genres = excluded.genres,
        description = excluded.description,
        tracks = excluded.tracks,
        s3_key = excluded.s3_key,
        legacy_download_url = COALESCE(excluded.legacy_download_url, collections.legacy_download_url),
        is_active = excluded.is_active,
        download_limit = excluded.download_limit,
        updated_at = excluded.updated_at
    `).run(
      input.number,
      input.date,
      input.size,
      input.sizeBytes ?? null,
      input.genres,
      input.description,
      input.tracks,
      input.s3Key ?? null,
      input.legacyDownloadUrl ?? null,
      Number(input.isActive),
      input.downloadLimit,
      now,
      now,
    );

    return mapCollection(getCollectionRow(db, input.number)!);
  });

  return run.immediate();
}
