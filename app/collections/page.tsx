import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { CollectionDownloadAction } from "@/components/collections/CollectionDownloadAction";
import { getCurrentUser } from "@/lib/auth/session";
import { hasClubAccess } from "@/lib/access/subscription";
import {
  getCollections,
  getDemoCollection,
} from "@/lib/content/collections";
import { getRemainingDownloadCount } from "@/lib/downloads/store";
import { formatTrackCount } from "@/lib/content/track-count";
import { getDemoAccessState } from "@/lib/content/demo-access";
import {
  buildCollectionArchive,
  formatArchiveTrackTotal,
  formatReleaseCount,
} from "@/lib/content/collection-archive";

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

const DEMO_VISIBLE_GENRE_LIMIT = 6;
const DEMO_RETURN_PATH = "/collections#demo-download";
const DEMO_REGISTER_PATH = `/register?next=${encodeURIComponent(DEMO_RETURN_PATH)}`;

function parseGenreTips(genres: string) {
  return genres
    .split(/[·/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)(\d+)$/);

      if (!match) {
        return {
          name: item,
          count: null as null | string,
        };
      }

      return {
        name: match[1].trim(),
        count: match[2],
      };
    });
}

export default async function CollectionsPage({
  searchParams,
}: CollectionsPageProps) {
  const user = await getCurrentUser();
  const collections = await getCollections();
  const demoCollection = await getDemoCollection();
  const params = searchParams ? await searchParams : {};
  const hasPaidPlan = user ? hasClubAccess(user) : false;
  const archive = buildCollectionArchive(collections);
  const demoAccessState = getDemoAccessState({
    hasPaidPlan,
    hasUser: Boolean(user),
    hasArchive: Boolean(demoCollection.s3Key),
  });
  const activeDownloadMessage =
    params.download && params.collection
      ? downloadMessages[params.download]
      : undefined;
  const demoGenreTips = parseGenreTips(demoCollection.genres);
  const visibleDemoGenreTips = demoGenreTips.slice(0, DEMO_VISIBLE_GENRE_LIMIT);
  const hiddenDemoGenreTips = demoGenreTips.slice(DEMO_VISIBLE_GENRE_LIMIT);
  const demoDownloadsLeft = user
    ? await getRemainingDownloadCount(
        user.id,
        demoCollection.number,
        demoCollection.downloadLimit,
      )
    : null;
  const collectionDownloadsLeft = new Map(
    hasPaidPlan && user
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
            Каждую неделю клуб пополняется качественно отобранными DJ-подборками
            для подготовки сетов и выступлений.
          </p>

          {!hasPaidPlan ? (
            <div className="collections-actions">
              <a className="button-main" href="/pricing">
                <span className="button-label">Вступить в клуб</span>
              </a>
            </div>
          ) : null}
        </div>

        <div className="collections-list">
          {demoAccessState !== "hidden" ? (
            <article
              className="collection-card collection-card-demo-split collection-demo-featured"
              id="demo-download"
              data-reveal
            >
              <div className="demo-card-copy">
                <div className="collection-release-meta">
                  <span>{formatTrackCount(demoCollection.tracks)}</span>
                  <span>{demoCollection.size}</span>
                  <time className="collection-release-date">{demoCollection.date}</time>
                </div>

                <h2>Демо-подборка</h2>

                <div
                  className="demo-card-tip-strip"
                  aria-label="Жанры демо-подборки"
                >
                  {visibleDemoGenreTips.map((tip) => (
                    <span
                      className="demo-card-tip"
                      key={`${tip.name}-${tip.count ?? "none"}`}
                    >
                      <span>{tip.name}</span>
                      {tip.count ? <strong>{tip.count}</strong> : null}
                    </span>
                  ))}
                  {hiddenDemoGenreTips.length > 0 ? (
                    <span
                      className="demo-card-more"
                      tabIndex={0}
                      aria-label={`Еще ${hiddenDemoGenreTips.length} скрытых стилей`}
                    >
                      +{hiddenDemoGenreTips.length}
                      <span className="demo-card-more-popover" role="tooltip">
                        {hiddenDemoGenreTips.map((tip) => (
                          <span
                            className="demo-card-more-item"
                            key={`${tip.name}-${tip.count ?? "none"}-hidden`}
                          >
                            <span>{tip.name}</span>
                            {tip.count ? <strong>{tip.count}</strong> : null}
                          </span>
                        ))}
                      </span>
                    </span>
                  ) : null}
                </div>

                {demoCollection.description ? (
                  <p className="collection-card-description demo-card-description">
                    {demoCollection.description}
                  </p>
                ) : null}

                <div className="collection-card-action demo-card-action">
                  {demoAccessState === "download" && demoDownloadsLeft !== null ? (
                    <CollectionDownloadAction
                      collectionNumber={demoCollection.number}
                      initialRemaining={demoDownloadsLeft}
                      label="Скачать демо"
                      limit={demoCollection.downloadLimit}
                    />
                  ) : demoAccessState === "register" ? (
                    <a className="button-main" href={DEMO_REGISTER_PATH}>
                      <span className="button-label">
                        Зарегистрироваться и скачать демо
                      </span>
                    </a>
                  ) : (
                    <span
                      className="button-outline button-disabled"
                      aria-disabled="true"
                    >
                      <span className="button-label">Демо пока недоступно</span>
                    </span>
                  )}

                  {demoAccessState === "register" ? (
                    <p className="collection-demo-access-note">
                      Бесплатно после регистрации. Оплата не нужна.
                    </p>
                  ) : null}

                  {params.collection === demoCollection.number &&
                  activeDownloadMessage ? (
                    <p className="collection-download-message">
                      {activeDownloadMessage}
                    </p>
                  ) : null}
                </div>
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

          {archive.groups.map((group) => (
            <section className="collection-month-group" key={group.key}>
              <header className="collection-month-head" data-reveal>
                <h2>{group.label}</h2>
                <div>
                  <span>
                    {formatArchiveTrackTotal(
                      group.totalTracks,
                      group.isApproximate,
                    )}
                  </span>
                  <span>{formatReleaseCount(group.releaseCount)}</span>
                </div>
              </header>

              <div className="collection-month-grid">
                {group.collections.map((collection) => {
                  const downloadsLeft =
                    collectionDownloadsLeft.get(collection.number) ?? null;
                  const genreTips = parseGenreTips(collection.genres);
                  const visibleGenreTips = genreTips.slice(
                    0,
                    DEMO_VISIBLE_GENRE_LIMIT,
                  );
                  const hiddenGenreTips = genreTips.slice(
                    DEMO_VISIBLE_GENRE_LIMIT,
                  );

                  return (
                    <article
                      className="collection-card collection-card-demo-split collection-release-card"
                      id={`collection-${collection.number}`}
                      key={collection.number}
                      data-reveal
                    >
                      <div className="demo-card-copy">
                        <div className="collection-release-meta">
                          <span>{formatTrackCount(collection.tracks)}</span>
                          <span>{collection.size}</span>
                          <time className="collection-release-date">{collection.date}</time>
                        </div>

                        <h2 className="collection-release-title">
                          <span>Подборка</span>
                          <strong>#{collection.number}</strong>
                        </h2>

                        <div
                          className="demo-card-tip-strip"
                          aria-label={`Жанры подборки ${collection.number}`}
                        >
                          {visibleGenreTips.map((tip) => (
                            <span
                              className="demo-card-tip"
                              key={`${collection.number}-${tip.name}-${tip.count ?? "none"}`}
                            >
                              <span>{tip.name}</span>
                              {tip.count ? <strong>{tip.count}</strong> : null}
                            </span>
                          ))}
                          {hiddenGenreTips.length > 0 ? (
                            <span
                              className="demo-card-more"
                              tabIndex={0}
                              aria-label={`Еще ${hiddenGenreTips.length} скрытых стилей`}
                            >
                              +{hiddenGenreTips.length}
                              <span
                                className="demo-card-more-popover"
                                role="tooltip"
                              >
                                {hiddenGenreTips.map((tip) => (
                                  <span
                                    className="demo-card-more-item"
                                    key={`${collection.number}-${tip.name}-${tip.count ?? "none"}-hidden`}
                                  >
                                    <span>{tip.name}</span>
                                    {tip.count ? (
                                      <strong>{tip.count}</strong>
                                    ) : null}
                                  </span>
                                ))}
                              </span>
                            </span>
                          ) : null}
                        </div>

                        {collection.description ? (
                          <p className="collection-card-description demo-card-description">
                            {collection.description}
                          </p>
                        ) : null}

                        <div className="collection-card-action demo-card-action">
                          {!hasPaidPlan ? (
                            <a
                              className="button-outline collection-locked-action"
                              href="/pricing"
                            >
                              <span
                                className="collection-lock-icon"
                                aria-hidden="true"
                              />
                              <span className="button-label">Открыть доступ</span>
                            </a>
                          ) : collection.s3Key && downloadsLeft !== null ? (
                            <CollectionDownloadAction
                              collectionNumber={collection.number}
                              initialRemaining={downloadsLeft}
                              label="Скачать подборку"
                              limit={collection.downloadLimit}
                            />
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

                          {hasPaidPlan &&
                          params.collection === collection.number &&
                          activeDownloadMessage ? (
                            <p className="collection-download-message">
                              {activeDownloadMessage}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
