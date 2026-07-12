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

export function formatTrackCount(value: string) {
  const normalizedValue = value.trim();
  const match = normalizedValue.match(/^(\d+)(\+)?$/);

  if (!match) {
    return normalizedValue;
  }

  const count = Number(match[1]);
  const suffix = match[2] ?? "";

  return `${count}${suffix} ${suffix ? "треков" : trackWord(count)}`;
}
