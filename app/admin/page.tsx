import { redirect } from "next/navigation";
import {
  resetDownloadLimitAction,
  saveCollectionAction,
} from "@/app/admin/actions";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { getUsers } from "@/lib/auth/store";
import { getDownloadRecords } from "@/lib/downloads/store";
import {
  getCollections,
  getDemoCollection,
} from "@/lib/content/collections";

type AdminPageProps = {
  searchParams?: Promise<{
    error?: string;
    reset?: string;
    saved?: string;
  }>;
};

function getNextCollectionNumber(
  collections: Awaited<ReturnType<typeof getCollections>>,
) {
  const latestNumber = Math.max(
    ...collections
      .map((collection) => Number(collection.number))
      .filter((number) => !Number.isNaN(number)),
  );

  if (!Number.isFinite(latestNumber)) {
    return "001";
  }

  return String(latestNumber + 1).padStart(3, "0");
}

function formatAdminDate(value?: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminUser(user)) {
    redirect("/account");
  }

  const params = searchParams ? await searchParams : {};
  const collections = await getCollections({ includeInactive: true });
  const demoCollection = await getDemoCollection();
  const downloadRecords = await getDownloadRecords();
  const users = await getUsers();
  const nextNumber = getNextCollectionNumber(collections);
  const items = [demoCollection, ...collections];

  return (
    <main className="page">
      <ScrollEffects />
      <Header />

      <section className="admin-page">
        <div className="admin-head" data-reveal>
          <div className="section-kicker"><span>DJ Vault</span><span>Admin</span></div>

          <h1>Панель управления</h1>
          <p>
            Выпуски, пользователи и лимиты скачивания — в одном рабочем пространстве.
          </p>

          {params.saved ? (
            <div className="admin-message">
              Подборка #{params.saved} сохранена.
            </div>
          ) : null}

          {params.error === "required" ? (
            <div className="admin-message admin-message-error">
              Заполните номер, дату, позиции и жанры.
            </div>
          ) : null}

          {params.error === "reset_required" ? (
            <div className="admin-message admin-message-error">
              Укажите user_id и номер архива для сброса лимита.
            </div>
          ) : null}

          {params.reset ? (
            <div className="admin-message">
              Лимит скачивания для архива #{params.reset} сброшен.
            </div>
          ) : null}
        </div>

        <nav className="admin-nav" aria-label="Разделы админ-панели" data-reveal>
          <a href="#collections">Подборки <span>{items.length}</span></a>
          <a href="#users">Пользователи <span>{users.length}</span></a>
          <a href="#downloads">Скачивания <span>{downloadRecords.length}</span></a>
        </nav>

        <section className="admin-section" id="collections">
          <div className="admin-section-head" data-reveal>
            <div><span>01 / Контент</span><h2>Подборки</h2></div>
            <p>Создавайте новые выпуски и контролируйте подключение архивов к S3.</p>
          </div>

          <div className="admin-grid admin-collections-grid">
          <form
            className="admin-card admin-form"
            action={saveCollectionAction}
            data-reveal
          >
            <div className="admin-card-head">
              <span>Редактор выпуска</span>
              <strong>Новая подборка</strong>
            </div>

            <label className="admin-field">
              <span>Номер</span>
              <input
                name="number"
                placeholder="028"
                defaultValue={nextNumber}
                required
              />
            </label>

            <label className="admin-field">
              <span>Дата</span>
              <input
                name="date"
                placeholder="13 июля 2026"
                required
              />
            </label>

            <label className="admin-field">
              <span>Позиции</span>
              <input name="tracks" placeholder="150+ позиций" required />
            </label>

            <label className="admin-field">
              <span>Жанры</span>
              <input
                name="genres"
                placeholder="Afro House / Deep House / Tech House"
                required
              />
            </label>

            <label className="admin-field">
              <span>S3 object key</span>
                <input
                  name="s3Key"
                  placeholder="archives/001.zip"
                />
            </label>

            <div className="admin-field-grid">
              <label className="admin-field">
                <span>Лимит скачиваний</span>
                <input
                  name="downloadLimit"
                  placeholder="2"
                  type="number"
                  min={1}
                  defaultValue={2}
                />
              </label>

              <div className="admin-field admin-check-field">
                <span>Статус</span>
                <label className="admin-checkbox">
                  <input name="isActive" type="checkbox" defaultChecked />
                  <span>Активен</span>
                </label>
              </div>
            </div>

            <label className="admin-field">
              <span>Описание</span>
              <textarea
                name="description"
                placeholder="Короткое описание выпуска для внутренних данных."
                rows={4}
              />
            </label>

            <p className="admin-hint">
              Чтобы обновить существующий выпуск, укажите тот же номер. Номер
              demo обновит демо-подборку. Объем подтянется из S3 по object key,
              если переменные S3 настроены.
            </p>

            <button className="button-main admin-submit" type="submit">
              <span className="button-label">Сохранить</span>
            </button>
          </form>

          <div className="admin-card admin-list" data-reveal>
            <div className="admin-card-head">
              <span>Все подборки</span>
              <strong>{items.length} выпусков</strong>
            </div>

            {items.map((collection) => (
              <article className="admin-row" key={collection.number}>
                <div className="admin-row-topline">
                  <span>#{collection.number}</span>
                  <strong>{collection.date}</strong>
                </div>

                <h2>Подборка #{collection.number}</h2>

                <p>
                  {collection.size} · {collection.tracks} · {collection.genres}
                </p>

                <em>
                  {collection.s3Key
                    ? collection.s3Key
                    : "S3 object key не добавлен"}
                </em>
                <span className={collection.isActive ? "admin-status admin-status-active" : "admin-status"}>
                  {collection.isActive ? "Опубликована" : "Скрыта"}
                </span>
              </article>
            ))}
          </div>
          </div>
        </section>

        <section className="admin-section" id="users">
          <div className="admin-section-head" data-reveal>
            <div><span>02 / Доступ</span><h2>Пользователи</h2></div>
            <p>Тариф, срок доступа и использованные скачивания видны в одной строке.</p>
          </div>

          <div className="admin-users" data-reveal>
            <div className="admin-users-head">
              <span>Пользователь</span><span>Тариф</span><span>Регистрация</span><span>Скачивания</span>
            </div>
            {users.length === 0 ? <p className="admin-empty">Пользователей пока нет.</p> : null}
            {users.map((item) => {
              const records = downloadRecords.filter((record) => record.userId === item.id);
              return (
                <article className="admin-user-row" key={item.id}>
                  <div className="admin-user-identity"><strong>{item.name}</strong><span>{item.email}</span></div>
                  <div className="admin-user-plan"><strong>{item.plan}</strong><span>{item.planExpiresAt ? `до ${formatAdminDate(item.planExpiresAt)}` : "без срока"}</span></div>
                  <time>{formatAdminDate(item.createdAt)}</time>
                  <div className="admin-user-downloads">
                    {records.length === 0 ? <span className="admin-muted">Нет скачиваний</span> : records.map((record) => (
                      <form action={resetDownloadLimitAction} className="admin-download-record" key={record.archiveId}>
                        <input name="userId" type="hidden" value={item.id} />
                        <input name="archiveId" type="hidden" value={record.archiveId} />
                        <span>#{record.archiveId} · {record.downloadCount}</span>
                        <button type="submit">Сбросить</button>
                      </form>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-section" id="downloads">
          <div className="admin-section-head" data-reveal>
            <div><span>03 / Журнал</span><h2>Скачивания</h2></div>
            <p>Последняя активность по каждому пользователю и архиву.</p>
          </div>
          <div className="admin-download-log" data-reveal>
            {downloadRecords.length === 0 ? <p className="admin-empty">Скачиваний пока нет.</p> : downloadRecords.map((record) => (
              <article key={`${record.userId}-${record.archiveId}`}>
                <span>#{record.archiveId}</span>
                <strong>{users.find((item) => item.id === record.userId)?.email ?? record.userId}</strong>
                <span>{record.downloadCount} скачиваний</span>
                <time>{formatAdminDate(record.downloadedAt)}</time>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
