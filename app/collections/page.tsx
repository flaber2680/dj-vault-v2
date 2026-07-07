import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getCollections,
  getDemoCollection,
} from "@/lib/content/collections";

export default async function CollectionsPage() {
  const user = await getCurrentUser();
  const collections = await getCollections();
  const demoCollection = await getDemoCollection();
  const hasPaidPlan = user ? user.plan !== "free" : false;

  return (
    <main className="page">
      <ScrollEffects />
      <Header />

      <section className="collections-page">
        <div className="collections-hero" data-reveal>
          <div className="section-kicker">
            <span>Архив</span>
            <span>Подборки DJ Vault</span>
          </div>

          <h1>Подборки DJ Vault</h1>

          <p>
            Каждую неделю архив пополняется готовым выпуском: отобранные треки,
            понятные жанровые папки и материал без лишнего перебора.
          </p>

          {!hasPaidPlan ? (
            <div className="collections-actions" id="demo-download">
              {demoCollection.downloadUrl ? (
                <a
                  className="button-main"
                  href={`/api/download/${demoCollection.number}`}
                >
                  <span className="button-label">Скачать демо подборку</span>
                </a>
              ) : (
                <span className="button-main button-disabled" aria-disabled="true">
                  <span className="button-label">Демо скоро появится</span>
                </span>
              )}

              <a className="button-outline" href="/pricing">
                <span className="button-label">Открыть весь архив</span>
              </a>
            </div>
          ) : null}
        </div>

        <div className="collections-list">
          {collections.length === 0 ? (
            <div className="collections-empty" data-reveal>
              <span>Архив готовится</span>
              <h2>Подборки скоро появятся</h2>
              <p>
                Сейчас список пустой. Новые выпуски появятся здесь сразу после
                публикации.
              </p>
            </div>
          ) : null}

          {collections.map((collection) => (
            <article
              className="collection-card"
              id={`collection-${collection.number}`}
              key={collection.number}
              data-reveal
            >
              <div className="collection-card-head">
                <span>#{collection.number}</span>
                <strong>{collection.date}</strong>
              </div>

              <h2>Подборка #{collection.number}</h2>

              <div className="collection-card-meta">
                <span>
                  {collection.size} · {collection.tracks}
                </span>
                <span>{collection.genres}</span>
              </div>

              {hasPaidPlan ? (
                <div className="collection-card-action">
                  {collection.downloadUrl ? (
                    <a
                      className="button-outline"
                      href={`/api/download/${collection.number}`}
                    >
                      <span className="button-label">Скачать подборку</span>
                    </a>
                  ) : (
                    <span
                      className="button-outline button-disabled"
                      aria-disabled="true"
                    >
                      <span className="button-label">Файл скоро появится</span>
                    </span>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
