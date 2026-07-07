import { redirect } from "next/navigation";
import { saveCollectionAction } from "@/app/admin/actions";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getCollections,
  getDemoCollection,
} from "@/lib/content/collections";

type AdminPageProps = {
  searchParams?: Promise<{
    error?: string;
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
  const collections = await getCollections();
  const demoCollection = await getDemoCollection();
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

          <h1>Управление архивом</h1>
          <p>
            Добавляйте новые выпуски, обновляйте ссылку скачивания и данные,
            которые видны пользователям на странице подборок.
          </p>

          {params.saved ? (
            <div className="admin-message">
              Подборка #{params.saved} сохранена.
            </div>
          ) : null}

          {params.error === "required" ? (
            <div className="admin-message admin-message-error">
              Заполните номер, дату, размер, треки и жанры.
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

            <div className="admin-field-grid">
              <label className="admin-field">
                <span>Размер</span>
                <input name="size" placeholder="4.28 GB" required />
              </label>

              <label className="admin-field">
                <span>Треки</span>
                <input name="tracks" placeholder="150+ треков" required />
              </label>
            </div>

            <label className="admin-field">
              <span>Жанры</span>
              <input
                name="genres"
                placeholder="Afro House / Deep House / Tech House"
                required
              />
            </label>

            <label className="admin-field">
              <span>Ссылка скачивания</span>
                <input
                  name="downloadUrl"
                  placeholder="https://..."
                  type="url"
                />
            </label>

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
              demo обновит демо-подборку.
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
                  {collection.downloadUrl
                    ? "Ссылка добавлена"
                    : "Файл не добавлен"}
                </em>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
