import type { PublicUser } from "@/lib/auth/store";
import type { getDownloadRecords } from "@/lib/downloads/store";

type DownloadRecord = Awaited<ReturnType<typeof getDownloadRecords>>[number];
type AdminDownloadsProps = { records: DownloadRecord[]; users: PublicUser[]; query: string };

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminDownloads({ records, users, query }: AdminDownloadsProps) {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const groups = Array.from(
    records.reduce((map, record) => {
      const group = map.get(record.userId) ?? [];
      group.push(record);
      map.set(record.userId, group);
      return map;
    }, new Map<string, DownloadRecord[]>()),
  )
    .map(([userId, userRecords]) => ({
      userId,
      user: userMap.get(userId),
      records: [...userRecords].sort((left, right) => (right.downloadedAt ?? "").localeCompare(left.downloadedAt ?? "")),
      totalDownloads: userRecords.reduce((sum, record) => sum + record.downloadCount, 0),
    }))
    .sort((left, right) => (right.records[0]?.downloadedAt ?? "").localeCompare(left.records[0]?.downloadedAt ?? ""));

  return (
    <section className="admin-workspace-section">
      <header className="admin-workspace-head">
        <div><span>04 / Журнал</span><h1>Скачивания</h1><p>История архивов сгруппирована по пользователям.</p></div>
      </header>
      <form className="admin-toolbar" action="/admin">
        <input name="section" type="hidden" value="downloads" />
        <label><span className="sr-only">Поиск скачиваний</span><input name="dq" defaultValue={query} placeholder="Архив, имя или email" /></label>
        <button type="submit">Найти</button>
        {query ? <a href="/admin?section=downloads">Сбросить</a> : null}
      </form>
      <div className="admin-download-groups">
        {groups.length === 0 ? <p className="admin-empty">Скачивания не найдены.</p> : null}
        {groups.map((group) => (
          <details className="admin-download-group" key={group.userId} open={Boolean(query)}>
            <summary>
              <span className="admin-download-group-user"><strong>{group.user?.name ?? "Пользователь"}</strong><small>{group.user?.email ?? group.userId}</small></span>
              <span>{group.records.length} архивов</span>
              <span>{group.totalDownloads} скачиваний</span>
              <time>{formatDate(group.records[0]?.downloadedAt)}</time>
            </summary>
            <div className="admin-download-group-records">
              {group.records.map((record) => (
                <div key={`${record.userId}-${record.archiveId}`}>
                  <strong>#{record.archiveId}</strong>
                  <span>{record.downloadCount} скачиваний</span>
                  <time>{formatDate(record.downloadedAt)}</time>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
