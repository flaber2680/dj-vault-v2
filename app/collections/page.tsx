import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getCollections,
  getDemoCollection,
} from "@/lib/content/collections";
import { getRemainingDownloadCount } from "@/lib/downloads/store";

type CollectionsPageProps = {
  searchParams?: Promise<{
    collection?: string;
    download?: string;
  }>;
};

const downloadMessages: Record<string, string> = {
  limit: "Лимит скачивания для этого архива исчерпан.",
  not_configured: "Ссылка на архив пока не подключена.",
  storage: "Не удалось подготовить временную ссылку. Напишите в поддержку.",
};

function formatDownloadsLeft(remaining: number, limit: number) {
  if (remaining <= 0) {
    return "Лимит скачивания исчерпан";
  }

  return `Осталось скачиваний: ${remaining} из ${limit}`;
}

export default async function CollectionsPage({
  searchParams,
}: CollectionsPageProps) {
  const user = await getCurrentUser();
  const collections = await getCollections();
  const demoCollection = await getDemoCollection();
  const params = searchParams ? await searchParams : {};
  const hasPaidPlan = user ? user.plan !== "free" : false;
  const activeDownloadMessage =
    params.download && params.collection
      ? downloadMessages[params.download]
      : undefined;
  const demoDownloadsLeft = user
    ? await getRemainingDownloadCount(
        user.id,
        demoCollection.number,
        demoCollection.downloadLimit,
      )
    : null;
  const collectionDownloadsLeft = new Map(
    user
      ? await Promise.all(
          collections.map(async (collection) => [
            collection.number,
            await getRemainingDownloadCount(
              user.id,
              collection.number,
              collection.downloadLimit,
            ),
          ] as const),
        )
      : [],
  );

  return (
    <main className="page">
      <ScrollEffects />
      <Header />

      <section className="collections-page">
        <div className="collections-hero" data-reveal>
          <div className="section-kicker">
            <span>Клуб</span>
            <span>Закрытые подборки</span>
          </div>

          <h1>Подборки DJ Vault</h1>

          <p>
            Каждую неделю клуб пополняется качественно отобранными
            DJ-подборками для подготовки сетов и выступлений.
          </p>

          {!hasPaidPlan ? (
            <div className="collections-actions" id="demo-download">
              <a className="button-main" href="/pricing">
                <span className="button-label">Вступить в клуб</span>
              </a>
            </div>
          ) : null}
        </div>

        <div className="collections-list">
          {!hasPaidPlan ? (
            <article
              className="collection-card collection-card-demo"
              id={`collection-${demoCollection.number}`}
              data-reveal
            >
              <div className="collection-card-head">
                <span>Демо</span>
                <strong>{demoCollection.date}</strong>
              </div>

              <h2>Демо-подборка</h2>

              <div className="collection-card-meta">
                <span>
                  {demoCollection.size} · {demoCollection.tracks}
                </span>
                <span>{demoCollection.genres}</span>
                {demoDownloadsLeft !== null ? (
                  <span>
                    {formatDownloadsLeft(
                      demoDownloadsLeft,
                      demoCollection.downloadLimit,
                    )}
                  </span>
                ) : null}
              </div>

              {demoCollection.description ? (
                <p className="collection-card-description">
                  {demoCollection.description}
                </p>
              ) : null}

              <div className="collection-card-action">
                {demoDownloadsLeft === 0 ? (
                  <span
                    className="button-outline button-disabled"
                    aria-disabled="true"
                  >
                    <span className="button-label">Лимит исчерпан</span>
                  </span>
                ) : demoCollection.s3Key ? (
                  <a
                    className="button-outline"
                    href={`/api/download/${demoCollection.number}`}
                  >
                    <span className="button-label">Скачать демо</span>
                  </a>
                ) : (
                  <span
                    className="button-outline button-disabled"
                    aria-disabled="true"
                  >
                    <span className="button-label">Демо скоро появится</span>
                  </span>
                )}

                {params.collection === demoCollection.number &&
                activeDownloadMessage ? (
                  <p className="collection-download-message">
                    {activeDownloadMessage}
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}

          {hasPaidPlan && collections.length === 0 ? (
            <div className="collections-empty" data-reveal>
              <span>Клуб готовится</span>
              <h2>Подборки скоро появятся</h2>
              <p>
                Сейчас список пустой. Новые выпуски появятся здесь сразу после
                публикации.
              </p>
            </div>
          ) : null}

          {collections.map((collection) => (
            (() => {
              const downloadsLeft =
                collectionDownloadsLeft.get(collection.number) ?? null;

              return (
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

                  <h2>Выпуск #{collection.number}</h2>

                  <div className="collection-card-meta">
                    <span>
                      {collection.size} · {collection.tracks}
                    </span>
                    <span>{collection.genres}</span>
                    {downloadsLeft !== null ? (
                      <span>
                        {formatDownloadsLeft(
                          downloadsLeft,
                          collection.downloadLimit,
                        )}
                      </span>
                    ) : null}
                  </div>

                  {hasPaidPlan ? (
                    <div className="collection-card-action">
                      {downloadsLeft === 0 ? (
                        <span
                          className="button-outline button-disabled"
                          aria-disabled="true"
                        >
                          <span className="button-label">Лимит исчерпан</span>
                        </span>
                      ) : collection.s3Key ? (
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
                          <span className="button-label">
                            Материал скоро появится
                          </span>
                        </span>
                      )}

                      {params.collection === collection.number &&
                      activeDownloadMessage ? (
                        <p className="collection-download-message">
                          {activeDownloadMessage}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })()
          ))}
        </div>
      </section>
    </main>
  );
}
