import { saveCollectionAction } from "@/app/admin/actions";
import { formatTrackCount } from "@/lib/content/track-count";
import type { CollectionItem } from "@/lib/content/collections";
import { AdminDrawer } from "@/app/admin/AdminDrawer";

type AdminCollectionsProps = {
  collections: CollectionItem[];
  nextNumber: string;
  selected?: CollectionItem;
  isNew: boolean;
  query: string;
};

export function AdminCollections({
  collections,
  nextNumber,
  selected,
  isNew,
  query,
}: AdminCollectionsProps) {
  const editorOpen = isNew || Boolean(selected);
  const editorItem = selected;

  return (
    <>
      <section className="admin-workspace-section">
        <header className="admin-workspace-head">
          <div>
            <span>01 / Контент</span>
            <h1>Подборки</h1>
            <p>Выпуски, архивы S3 и доступность контента.</p>
          </div>
          <a className="admin-primary-action" href="/admin?section=collections&collection=new">
            <span aria-hidden="true">+</span> Новая подборка
          </a>
        </header>

        <form className="admin-toolbar" action="/admin">
          <input name="section" type="hidden" value="collections" />
          <label>
            <span className="sr-only">Поиск подборок</span>
            <input name="cq" defaultValue={query} placeholder="Номер, дата, жанр или S3 key" />
          </label>
          <button type="submit">Найти</button>
          {query ? <a href="/admin?section=collections">Сбросить</a> : null}
        </form>

        <div className="admin-table admin-collection-table">
          <div className="admin-table-head">
            <span>Выпуск</span><span>Содержимое</span><span>Архив</span><span>Статус</span>
          </div>
          {collections.length === 0 ? <p className="admin-empty">Подборки не найдены.</p> : null}
          {collections.map((collection) => (
            <a
              className="admin-table-row"
              href={`/admin?section=collections&collection=${encodeURIComponent(collection.number)}`}
              key={collection.number}
            >
              <div className="admin-table-primary">
                <strong>#{collection.number}</strong>
                <span>{collection.date}</span>
              </div>
              <div>
                <strong>{formatTrackCount(collection.tracks)}</strong>
                <span>{collection.genres}</span>
              </div>
              <div>
                <strong>{collection.size || "Объём не определён"}</strong>
                <span>{collection.s3Key || "S3 key не добавлен"}</span>
              </div>
              <div>
                <span className={collection.isActive ? "admin-state is-positive" : "admin-state"}>
                  {collection.isActive ? "Опубликована" : "Скрыта"}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {editorOpen ? (
        <AdminDrawer
          closeHref="/admin?section=collections"
          eyebrow={isNew ? "Новый выпуск" : `Подборка #${editorItem?.number}`}
          title={isNew ? "Новая подборка" : "Редактирование"}
        >
          <form action={saveCollectionAction} className="admin-drawer-form">
            <div className="admin-form-grid">
              <label className="admin-field admin-field-short">
                <span>Номер</span>
                <input name="number" defaultValue={editorItem?.number ?? nextNumber} required />
              </label>
              <label className="admin-field admin-field-wide">
                <span>Дата выпуска</span>
                <input name="date" defaultValue={editorItem?.date ?? ""} placeholder="13 июля 2026" required />
              </label>
              <label className="admin-field">
                <span>Количество треков</span>
                <input name="tracks" defaultValue={editorItem?.tracks ?? ""} placeholder="150+" required />
              </label>
              <label className="admin-field admin-field-short">
                <span>Лимит скачиваний</span>
                <input name="downloadLimit" type="number" min={1} defaultValue={editorItem?.downloadLimit ?? 2} />
              </label>
              <label className="admin-field admin-field-full">
                <span>Жанры</span>
                <input name="genres" defaultValue={editorItem?.genres ?? ""} placeholder="Afro House / Deep House / Tech House" required />
              </label>
              <label className="admin-field admin-field-full">
                <span>S3 object key</span>
                <input name="s3Key" defaultValue={editorItem?.s3Key ?? ""} placeholder="archives/028.zip" />
              </label>
              <label className="admin-field admin-field-full">
                <span>Описание</span>
                <textarea name="description" defaultValue={editorItem?.description ?? ""} rows={4} />
              </label>
              <label className="admin-switch admin-field-full">
                <input name="isActive" type="checkbox" defaultChecked={editorItem?.isActive ?? true} />
                <span>Подборка опубликована</span>
              </label>
            </div>
            <div className="admin-drawer-actions">
              <a href="/admin?section=collections">Отмена</a>
              <button type="submit">Сохранить</button>
            </div>
          </form>
        </AdminDrawer>
      ) : null}
    </>
  );
}
