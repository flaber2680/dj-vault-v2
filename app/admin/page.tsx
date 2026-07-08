import { redirect } from "next/navigation";
import {
  resetDownloadLimitAction,
  saveCollectionAction,
} from "@/app/admin/actions";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
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
  const nextNumber = getNextCollectionNumber(collections);
  const items = [demoCollection, ...collections];

  return (
    <main className="page">
      <ScrollEffects />
      <Header />

      <section className="admin-page">
        <div className="admin-head" data-reveal>
          <div className="section-kicker">
            <span>Admin</span>
            <span>Подборки</span>
          </div>

          <h1>Управление подборками</h1>
          <p>
            Добавляйте выпуски, указывайте S3 object key приватного ZIP-архива
            и управляйте лимитами скачивания.
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

        <div className="admin-grid">
          <form
            className="admin-card admin-form"
            action={saveCollectionAction}
            data-reveal
          >
            <div className="admin-card-head">
              <span>Новая / существующая</span>
              <strong>Сохранить подборку</strong>
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
              <span>Список</span>
              <strong>{items.length} выпусков</strong>
            </div>

            {items.map((collection) => (
              <article className="admin-row" key={collection.number}>
                <div>
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
              </article>
            ))}
          </div>

          <form
            className="admin-card admin-form"
            action={resetDownloadLimitAction}
            data-reveal
          >
            <div className="admin-card-head">
              <span>Сброс лимита</span>
              <strong>По пользователю</strong>
            </div>

            <label className="admin-field">
              <span>User ID</span>
              <input name="userId" placeholder="user_id" required />
            </label>

            <label className="admin-field">
              <span>Номер архива</span>
              <input name="archiveId" placeholder="001" required />
            </label>

            <button className="button-outline admin-submit" type="submit">
              <span className="button-label">Сбросить лимит</span>
            </button>
          </form>

          <div className="admin-card admin-list" data-reveal>
            <div className="admin-card-head">
              <span>Скачивания</span>
              <strong>{downloadRecords.length} записей</strong>
            </div>

            {downloadRecords.length === 0 ? (
              <p className="admin-hint">Пока нет записей скачивания.</p>
            ) : null}

            {downloadRecords.map((record) => (
              <article
                className="admin-row"
                key={`${record.userId}-${record.archiveId}`}
              >
                <div>
                  <span>#{record.archiveId}</span>
                  <strong>{record.downloadCount} попыток</strong>
                </div>

                <p>
                  USER: {record.userId}
                  <br />
                  ПОСЛЕДНЕЕ: {record.downloadedAt ?? "нет"}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
