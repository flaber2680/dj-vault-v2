export type DownloadUsageRecord = {
  downloadCount?: number;
} | null;

export function getDownloadUsageSummary(
  record: DownloadUsageRecord,
  limit: number,
) {
  const used = record?.downloadCount ?? 0;
  const remaining = Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    label: `${used} / ${limit} / ${remaining}`,
  };
}
