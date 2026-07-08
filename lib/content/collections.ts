import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type CollectionItem = {
  number: string;
  date: string;
  size: string;
  genres: string;
  description: string;
  tracks: string;
  downloadUrl?: string;
};

export type CollectionInput = {
  number: string;
  date: string;
  size: string;
  genres: string;
  description?: string;
  tracks: string;
  downloadUrl?: string;
};

export const DEMO_COLLECTION_NUMBER = "demo";

const dataDirectory = path.join(process.cwd(), ".data");
const collectionsFile = path.join(dataDirectory, "collections.json");

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
  date: "Демо доступ",
  size: "Lite",
  genres: "Afro House / Deep House / Tech House",
  description:
    "Короткий демо-выпуск, чтобы оценить качество отбора и формат подборки.",
  tracks: "Демо выпуск",
  downloadUrl: "",
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
    downloadUrl: "",
  },
  {
    number: "026",
    date: "29 июня 2026",
    size: "3.91 GB",
    genres: "Tech House / Minimal",
    description:
      "Собранная подборка для разгона танцпола и середины ночи, где важны энергия и чистая динамика.",
    tracks: "130+ позиций",
    downloadUrl: "",
  },
  {
    number: "025",
    date: "22 июня 2026",
    size: "4.67 GB",
    genres: "Melodic House / Techno",
    description:
      "Более атмосферный выпуск с плотной драматургией для длинных сетов и аккуратных переходов.",
    tracks: "160+ позиций",
    downloadUrl: "",
  },
  {
    number: "024",
    date: "15 июня 2026",
    size: "4.12 GB",
    genres: "Afro House / Organic House / Deep",
    description:
      "Теплая подборка с вокальными хуками, перкуссией и материалом для плавного сета.",
    tracks: "140+ позиций",
    downloadUrl: "",
  },
];

function normalizeCollectionNumber(number: string) {
  return number.trim().replace(/^#/, "").toLowerCase();
}

function normalizeCollection(input: CollectionInput): CollectionItem {
  const number = normalizeCollectionNumber(input.number);
  const date = input.date.trim();
  const size = input.size.trim();
  const genres = input.genres.trim();
  const tracks = input.tracks.trim();
  const description = input.description?.trim() ?? "";
  const downloadUrl = input.downloadUrl?.trim() ?? "";

  if (!number || !date || !size || !genres || !tracks) {
    throw new Error("INVALID_COLLECTION");
  }

  return {
    number,
    date,
    size,
    genres,
    description,
    tracks,
    downloadUrl,
  };
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

async function readStoredCollections(): Promise<CollectionItem[]> {
  try {
    const raw = await readFile(collectionsFile, "utf8");
    const parsed = JSON.parse(raw) as CollectionInput[];

    return parsed.map(normalizeCollection);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeStoredCollections(items: CollectionItem[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(collectionsFile, JSON.stringify(items, null, 2), "utf8");
}

async function getMergedCollections() {
  const storedCollections = await readStoredCollections();
  const byNumber = new Map<string, CollectionItem>();

  for (const collection of storedCollections) {
    byNumber.set(collection.number, collection);
  }

  return Array.from(byNumber.values());
}

export async function getCollections() {
  const mergedCollections = await getMergedCollections();

  return sortCollections(
    mergedCollections.filter(
      (collection) => collection.number !== DEMO_COLLECTION_NUMBER,
    ),
  );
}

export async function getDemoCollection() {
  const storedCollections = await readStoredCollections();

  return (
    storedCollections.find(
      (collection) => collection.number === DEMO_COLLECTION_NUMBER,
    ) ?? demoCollection
  );
}

export async function findCollectionByNumber(number: string) {
  const normalizedNumber = normalizeCollectionNumber(number);

  if (normalizedNumber === DEMO_COLLECTION_NUMBER) {
    return getDemoCollection();
  }

  const mergedCollections = await getMergedCollections();

  return (
    mergedCollections.find(
      (collection) => collection.number === normalizedNumber,
    ) ?? null
  );
}

export async function saveCollection(input: CollectionInput) {
  const collection = normalizeCollection(input);
  const storedCollections = await readStoredCollections();
  const nextCollections = storedCollections.filter(
    (item) => item.number !== collection.number,
  );

  nextCollections.push(collection);
  await writeStoredCollections(sortCollections(nextCollections));

  return collection;
}
