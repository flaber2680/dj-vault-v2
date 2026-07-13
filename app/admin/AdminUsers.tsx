import {
  createPromoCodeAction,
  resetDownloadLimitAction,
  updateUserAccessAction,
} from "@/app/admin/actions";
import { AdminDrawer } from "@/app/admin/AdminDrawer";
import type { PublicUser } from "@/lib/auth/store";
import type { CollectionItem } from "@/lib/content/collections";
import type { getDownloadRecords } from "@/lib/downloads/store";
import { getDownloadUsageSummary } from "@/lib/downloads/usage";
import type { getPromoCodeDashboard } from "@/lib/referrals/store";

type DownloadRecord = Awaited<ReturnType<typeof getDownloadRecords>>[number];
type PromoDashboard = Awaited<ReturnType<typeof getPromoCodeDashboard>>;

type AdminUsersProps = {
  users: PublicUser[];
  selected?: PublicUser;
  collections: CollectionItem[];
  downloads: DownloadRecord[];
  promoDashboard: PromoDashboard;
  query: string;
};

function formatDate(value?: string) {
  if (!value) return "Без срока";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function daysRemaining(value?: string) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 86_400_000));
}

export function AdminUsers({
  users,
  selected,
  collections,
  downloads,
  promoDashboard,
  query,
}: AdminUsersProps) {
  const codesByOwner = promoDashboard.reduce((map, item) => {
    const codes = map.get(item.code.ownerUserId) ?? [];
    codes.push(item.code.code);
    map.set(item.code.ownerUserId, codes);
    return map;
  }, new Map<string, string[]>());
  const selectedDownloads = selected
    ? downloads.filter((record) => record.userId === selected.id)
    : [];

  return (
    <>
      <section className="admin-workspace-section">
        <header className="admin-workspace-head">
          <div>
            <span>02 / Доступ</span>
            <h1>Пользователи</h1>
            <p>Доступ Club, сроки, промокоды и активность.</p>
          </div>
        </header>

        <form className="admin-toolbar" action="/admin">
          <input name="section" type="hidden" value="users" />
          <label>
            <span className="sr-only">Поиск пользователей</span>
            <input name="q" defaultValue={query} placeholder="Имя, email, доступ или промокод" />
          </label>
          <button type="submit">Найти</button>
          {query ? <a href="/admin?section=users">Сбросить</a> : null}
        </form>

        <div className="admin-table admin-users-table">
          <div className="admin-table-head">
            <span>Пользователь</span><span>Доступ</span><span>Промокод</span><span>Активность</span>
          </div>
          {users.length === 0 ? <p className="admin-empty">Пользователи не найдены.</p> : null}
          {users.map((user) => {
            const userDownloads = downloads.filter((record) => record.userId === user.id);
            return (
              <a
                className="admin-table-row"
                href={`/admin?section=users&user=${encodeURIComponent(user.id)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                key={user.id}
              >
                <div className="admin-table-primary"><strong>{user.name}</strong><span>{user.email}</span></div>
                <div><strong>{user.plan === "club" ? "CLUB" : "FREE"}</strong><span>{user.planExpiresAt ? `до ${formatDate(user.planExpiresAt)} · ${daysRemaining(user.planExpiresAt)} дн.` : "без срока"}</span></div>
                <div><strong>{codesByOwner.get(user.id)?.join(", ") ?? "—"}</strong><span>{codesByOwner.has(user.id) ? "Активен" : "Не выдан"}</span></div>
                <div><strong>{userDownloads.length}</strong><span>{userDownloads.length === 1 ? "архив" : "архивов"}</span></div>
              </a>
            );
          })}
        </div>
      </section>

      {selected ? (
        <AdminDrawer closeHref={`/admin?section=users${query ? `&q=${encodeURIComponent(query)}` : ""}`} eyebrow="Управление пользователем" title={selected.name}>
          <div className="admin-user-summary">
            <span>{selected.email}</span>
            <span>Регистрация: {formatDate(selected.createdAt)}</span>
          </div>

          <section className="admin-drawer-section">
            <header><span>Доступ</span><strong>{selected.plan === "club" ? "CLUB" : "FREE"}</strong></header>
            <p>{selected.planExpiresAt ? `Активен до ${formatDate(selected.planExpiresAt)} · осталось ${daysRemaining(selected.planExpiresAt)} дн.` : "Срок доступа не установлен."}</p>
            <form action={updateUserAccessAction} className="admin-inline-form">
              <input name="userId" type="hidden" value={selected.id} />
              <label><span>Тип доступа</span><select name="accessPlan" defaultValue={selected.plan}><option value="free">Free</option><option value="club">Club</option></select></label>
              <label><span>Добавить дней</span><input name="days" type="number" min={0} max={3650} step={1} placeholder="0" /></label>
              <button type="submit">Применить</button>
            </form>
          </section>

          <section className="admin-drawer-section">
            <header><span>Промокоды</span><strong>{codesByOwner.get(selected.id)?.join(", ") ?? "Не выданы"}</strong></header>
            <form action={createPromoCodeAction} className="admin-inline-form admin-inline-form-promo">
              <input name="userId" type="hidden" value={selected.id} />
              <label><span>Новый код</span><input name="code" placeholder="PROMO" /></label>
              <button type="submit">Выдать</button>
            </form>
          </section>

          <section className="admin-drawer-section">
            <header><span>Скачивания</span><strong>{selectedDownloads.length}</strong></header>
            <div className="admin-drawer-downloads">
              {selectedDownloads.length === 0 ? <p>Скачиваний пока нет.</p> : null}
              {selectedDownloads.map((record) => {
                const collection = collections.find((item) => item.number === record.archiveId);
                const usage = getDownloadUsageSummary(record, collection?.downloadLimit ?? record.downloadCount);
                return (
                  <form action={resetDownloadLimitAction} key={record.archiveId}>
                    <input name="userId" type="hidden" value={selected.id} />
                    <input name="archiveId" type="hidden" value={record.archiveId} />
                    <div><strong>#{record.archiveId}</strong><span>{usage.label} · использовано / лимит / осталось</span></div>
                    <button type="submit">Сбросить</button>
                  </form>
                );
              })}
            </div>
          </section>
        </AdminDrawer>
      ) : null}
    </>
  );
}
