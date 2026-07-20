import {
  getDownloadRecord as getStoredDownloadRecord,
  getDownloadRecords as getStoredDownloadRecords,
  registerDownloadAttempt as registerStoredDownloadAttempt,
  resetDownloadLimit as resetStoredDownloadLimit,
  type DownloadEventRecord,
  type DownloadRecord as StoredDownloadRecord,
} from "../database/repositories/downloads.ts";

export type DownloadEvent = DownloadEventRecord;
export type DownloadRecord = StoredDownloadRecord;

export async function getDownloadRecords() {
  return getStoredDownloadRecords();
}

export async function getDownloadRecord(userId: string, archiveId: string) {
  return getStoredDownloadRecord(userId, archiveId);
}

export async function getRemainingDownloadCount(
  userId: string,
  archiveId: string,
  limit: number,
) {
  const record = getStoredDownloadRecord(userId, archiveId);
  return Math.max(0, limit - (record?.downloadCount ?? 0));
}

export async function registerDownloadAttempt(input: {
  archiveId: string;
  ipAddress: string;
  limit: number;
  userAgent: string;
  userId: string;
}) {
  return registerStoredDownloadAttempt(input);
}

export async function resetDownloadLimit(userId: string, archiveId: string) {
  resetStoredDownloadLimit(userId, archiveId);
}
