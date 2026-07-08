import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type DownloadEvent = {
  downloadedAt: string;
  ipAddress: string;
  userAgent: string;
};

export type DownloadRecord = {
  userId: string;
  archiveId: string;
  downloadCount: number;
  downloadedAt?: string;
  events: DownloadEvent[];
  updatedAt: string;
};

const dataDirectory = path.join(process.cwd(), ".data");
const downloadsFile = path.join(dataDirectory, "downloads.json");

async function readRecords(): Promise<DownloadRecord[]> {
  try {
    const raw = await readFile(downloadsFile, "utf8");

    return JSON.parse(raw) as DownloadRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeRecords(records: DownloadRecord[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(downloadsFile, JSON.stringify(records, null, 2), "utf8");
}

function getRecordKey(userId: string, archiveId: string) {
  return `${userId}:${archiveId}`;
}

export async function getDownloadRecords() {
  return readRecords();
}

export async function getDownloadRecord(userId: string, archiveId: string) {
  const records = await readRecords();

  return (
    records.find(
      (record) =>
        getRecordKey(record.userId, record.archiveId) ===
        getRecordKey(userId, archiveId),
    ) ?? null
  );
}

export async function registerDownloadAttempt({
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
}) {
  const records = await readRecords();
  const key = getRecordKey(userId, archiveId);
  const now = new Date().toISOString();
  let record = records.find(
    (item) => getRecordKey(item.userId, item.archiveId) === key,
  );

  if (record && record.downloadCount >= limit) {
    return {
      allowed: false,
      record,
    };
  }

  if (!record) {
    record = {
      userId,
      archiveId,
      downloadCount: 0,
      events: [],
      updatedAt: now,
    };
    records.push(record);
  }

  record.downloadCount += 1;
  record.downloadedAt = now;
  record.updatedAt = now;
  record.events.push({
    downloadedAt: now,
    ipAddress,
    userAgent,
  });

  await writeRecords(records);

  return {
    allowed: true,
    record,
  };
}

export async function resetDownloadLimit(userId: string, archiveId: string) {
  const records = await readRecords();
  const key = getRecordKey(userId, archiveId);
  const nextRecords = records.filter(
    (record) => getRecordKey(record.userId, record.archiveId) !== key,
  );

  await writeRecords(nextRecords);
}
