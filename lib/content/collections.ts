import {
  findCollectionRecord,
  getCollectionRecords,
  saveCollectionRecord,
  type CollectionRecord,
} from "../database/repositories/collections.ts";

export type CollectionItem = {
  number: string;
  date: string;
  size: string;
  sizeBytes?: number;
  genres: string;
  description: string;
  tracks: string;
  s3Key?: string;
  isActive: boolean;
  downloadLimit: number;
};

export type CollectionInput = {
  number: string;
  date: string;
  size?: string;
  sizeBytes?: number;
  genres: string;
  description?: string;
  tracks: string;
  s3Key?: string;
  downloadLimit?: string | number;
  isActive?: boolean;
  downloadUrl?: string;
};

export const DEMO_COLLECTION_NUMBER = "demo";

export const latestGenres = [
  "Afro House",
  "Deep House",
  "Tech House",
  "Melodic House",
  "Minimal",
  "+8",
];

export const demoCollection: CollectionItem = {
  number: DEMO_COLLECTION_NUMBER,
  date: "08.07.26",
  size: "376.81 MB",
  genres: "Afro 9 · Afro (Rus) 6 · Breakbeat 4 · House 6 · Indie Dance 6 · Pop (Eng) 2 · Pop (Rus) 8",
  description:
    "Короткий фрагмент закрытой библиотеки DJ Vault: отобранные треки без случайного мусора, подготовленные для DJ-сета.",
  tracks: "41 трек",
  s3Key: "",
  isActive: true,
  downloadLimit: 2,
};

export const collections: CollectionItem[] = [
  {
    number: "027",
    date: "06 июля 2026",
    size: "4.28 GB",
    genres: "Afro House / Deep House / Tech House / +1",
    description:
      "Свежий выпуск для клубного сета: плотный грув, понятная структура и аккуратный отбор.",
    tracks: "150+ позиций",
    s3Key: "",
    isActive: true,
    downloadLimit: 2,
  },
  {
    number: "026",
    date: "29 июня 2026",
    size: "3.91 GB",
    genres: "Tech House / Minimal",
    description:
      "Собранная подборка для разгона танцпола и середины ночи, где важны энергия и чистая динамика.",
    tracks: "130+ позиций",
    s3Key: "",
    isActive: true,
    downloadLimit: 2,
  },
  {
    number: "025",
    date: "22 июня 2026",
    size: "4.67 GB",
    genres: "Melodic House / Techno",
    description:
      "Более атмосферный выпуск с плотной драматургией для длинных сетов и аккуратных переходов.",
    tracks: "160+ позиций",
    s3Key: "",
    isActive: true,
    downloadLimit: 2,
  },
  {
    number: "024",
    date: "15 июня 2026",
    size: "4.12 GB",
    genres: "Afro House / Organic House / Deep",
    description:
      "Теплая подборка с вокальными хуками, перкуссией и материалом для плавного сета.",
    tracks: "140+ позиций",
    s3Key: "",
    isActive: true,
    downloadLimit: 2,
  },
];

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function normalizeCollectionNumber(number: string) {
  return number.trim().replace(/^#/, "").toLowerCase();
}

function normalizeCollection(input: CollectionInput): CollectionItem {
  const number = normalizeCollectionNumber(input.number);
  const date = input.date.trim();
  const sizeBytes = input.sizeBytes;
  const size = input.size?.trim() || formatBytes(sizeBytes) || "Размер не проверен";
  const genres = input.genres.trim();
  const tracks = input.tracks.trim();
  const description = input.description?.trim() ?? "";
  const legacyDownloadUrl = input.downloadUrl?.trim() ?? "";
  const s3Key =
    input.s3Key?.trim() ||
    (legacyDownloadUrl && !/^https?:\/\//i.test(legacyDownloadUrl)
      ? legacyDownloadUrl
      : "");
  const downloadLimit = Number(input.downloadLimit ?? 2);

  if (!number || !date || !genres || !tracks) {
    throw new Error("INVALID_COLLECTION");
  }

  return {
    number,
    date,
    size,
    sizeBytes,
    genres,
    description,
    tracks,
    s3Key,
    isActive: input.isActive ?? true,
    downloadLimit: Number.isFinite(downloadLimit) && downloadLimit > 0 ? downloadLimit : 2,
  };
}

async function enrichCollectionFromS3(input: CollectionInput) {
  const s3Key = input.s3Key?.trim();
  if (!s3Key) {
    return input;
  }

  try {
    const { getS3ObjectMetadata } = await import("@/lib/storage/s3");
    const metadata = await getS3ObjectMetadata(s3Key);
    if (!metadata?.contentLength) {
      return input;
    }

    return {
      ...input,
      size: formatBytes(metadata.contentLength),
      sizeBytes: metadata.contentLength,
    };
  } catch {
    return input;
  }
}

function toCollectionItem(record: CollectionRecord): CollectionItem {
  const legacyDownloadUrl = record.legacyDownloadUrl?.trim();
  const collection = {
    ...record,
    s3Key:
      record.s3Key?.trim() ||
      (legacyDownloadUrl && !/^https?:\/\//i.test(legacyDownloadUrl)
        ? legacyDownloadUrl
        : undefined),
  };
  delete collection.legacyDownloadUrl;
  return collection;
}

function sortCollections(items: CollectionItem[]) {
  return [...items].sort((left, right) => {
    const leftNumber = Number(left.number);
    const rightNumber = Number(right.number);
    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
      return rightNumber - leftNumber;
    }
    return right.number.localeCompare(left.number, "ru");
  });
}

export async function getCollections(
  options: {
    includeInactive?: boolean;
  } = {},
) {
  return sortCollections(
    getCollectionRecords()
      .map(toCollectionItem)
      .filter(
        (collection) =>
          collection.number !== DEMO_COLLECTION_NUMBER &&
          (options.includeInactive || collection.isActive),
      ),
  );
}

export async function getDemoCollection() {
  const collection = findCollectionRecord(DEMO_COLLECTION_NUMBER);
  return collection ? toCollectionItem(collection) : demoCollection;
}

export async function findCollectionByNumber(number: string) {
  const normalizedNumber = normalizeCollectionNumber(number);
  if (normalizedNumber === DEMO_COLLECTION_NUMBER) {
    return getDemoCollection();
  }

  const collection = findCollectionRecord(normalizedNumber);
  return collection ? toCollectionItem(collection) : null;
}

export async function saveCollection(input: CollectionInput) {
  const collection = normalizeCollection(await enrichCollectionFromS3(input));
  const legacyDownloadUrl = input.downloadUrl?.trim() || undefined;

  return toCollectionItem(
    saveCollectionRecord({ ...collection, legacyDownloadUrl }),
  );
}
