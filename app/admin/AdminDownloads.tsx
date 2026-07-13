import type { PublicUser } from "@/lib/auth/store";
import type { getDownloadRecords } from "@/lib/downloads/store";

type DownloadRecord = Awaited<ReturnType<typeof getDownloadRecords>>[number];

type AdminDownloadsProps = { records: DownloadRecord[]; users: PublicUser[]; query: string };

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function AdminDownloads({ records, users, query }: AdminDownloadsProps) {
  const userMap = new Map(users.map((user) => [user.id, user]));
  return (
    <section className="admin-workspace-section">
      <header className="admin-workspace-head"><div><span>04 / Журнал</span><h1>Скачивания</h1><p>Последняя активность пользователей по архивам.</p></div></header>
      <form className="admin-toolbar" action="/admin">
        <input name="section" type="hidden" value="downloads" />
        <label><span className="sr-only">Поиск скачиваний</span><input name="dq" defaultValue={query} placeholder="Архив, имя или email" /></label>
        <button type="submit">Найти</button>
        {query ? <a href="/admin?section=downloads">Сбросить</a> : null}
      </form>
      <div className="admin-table admin-downloads-table">
        <div className="admin-table-head"><span>Архив</span><span>Пользователь</span><span>Использовано</span><span>Последнее скачивание</span></div>
        {records.length === 0 ? <p className="admin-empty">Скачивания не найдены.</p> : null}
        {records.map((record) => {
          const user = userMap.get(record.userId);
          return <div className="admin-table-row" key={`${record.userId}-${record.archiveId}`}><div className="admin-table-primary"><strong>#{record.archiveId}</strong><span>Архив</span></div><div><strong>{user?.name ?? "Пользователь"}</strong><span>{user?.email ?? record.userId}</span></div><div><strong>{record.downloadCount}</strong><span>скачиваний</span></div><time>{formatDate(record.downloadedAt)}</time></div>;
        })}
      </div>
    </section>
  );
}
