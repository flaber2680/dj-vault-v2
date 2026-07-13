type ArchiveCollection = {
  date: string;
  tracks: string;
};

const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const russianMonthNumbers: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
};

function parseCollectionMonth(value: string) {
  const numericMatch = value.trim().match(/^\d{1,2}\.(\d{1,2})\.(\d{2}|\d{4})$/);

  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const rawYear = Number(numericMatch[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    if (month >= 1 && month <= 12) {
      return { month, year };
    }
  }

  const textMatch = value
    .trim()
    .toLocaleLowerCase("ru")
    .match(/^\d{1,2}\s+([а-яё]+)\s+(\d{4})$/u);

  if (!textMatch) {
    return null;
  }

  const month = russianMonthNumbers[textMatch[1]];

  return month ? { month, year: Number(textMatch[2]) } : null;
}

function parseTrackAmount(value: string) {
  const match = value.trim().match(/^(\d+)\s*(\+)?/);

  return {
    count: match ? Number(match[1]) : 0,
    isApproximate: Boolean(match?.[2]),
  };
}

function releaseWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "выпуск";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "выпуска";
  }

  return "выпусков";
}

function trackWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "трек";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "трека";
  }

  return "треков";
}

export function formatArchiveTrackTotal(count: number, isApproximate: boolean) {
  return `${isApproximate ? "≈ " : ""}${count} ${trackWord(count)}`;
}

export function formatReleaseCount(count: number) {
  return `${count} ${releaseWord(count)}`;
}

export function buildCollectionArchive<T extends ArchiveCollection>(
  collections: readonly T[],
) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      sortValue: number;
      totalTracks: number;
      isApproximate: boolean;
      releaseCount: number;
      collections: T[];
    }
  >();
  let totalTracks = 0;
  let isApproximate = false;

  for (const collection of collections) {
    const parsedMonth = parseCollectionMonth(collection.date);
    const trackAmount = parseTrackAmount(collection.tracks);
    const key = parsedMonth
      ? `${parsedMonth.year}-${String(parsedMonth.month).padStart(2, "0")}`
      : "unknown";
    const group = groups.get(key) ?? {
      key,
      label: parsedMonth
        ? `${monthNames[parsedMonth.month - 1]} ${parsedMonth.year}`
        : "Дата не указана",
      sortValue: parsedMonth ? parsedMonth.year * 100 + parsedMonth.month : -1,
      totalTracks: 0,
      isApproximate: false,
      releaseCount: 0,
      collections: [],
    };

    group.totalTracks += trackAmount.count;
    group.isApproximate ||= trackAmount.isApproximate;
    group.releaseCount += 1;
    group.collections.push(collection);
    groups.set(key, group);

    totalTracks += trackAmount.count;
    isApproximate ||= trackAmount.isApproximate;
  }

  return {
    totalTracks,
    isApproximate,
    releaseCount: collections.length,
    groups: Array.from(groups.values()).sort(
      (left, right) => right.sortValue - left.sortValue,
    ),
  };
}
