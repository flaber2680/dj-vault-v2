import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { hasClubAccess } from "@/lib/access/subscription";
import { getCollections, latestGenres } from "@/lib/content/collections";
import { accessPackageList } from "@/lib/content/plans";
import { formatTrackCount } from "@/lib/content/track-count";

const ordinarySteps = [
  "Открыть DJ Pool",
  "Просмотреть сотни новых релизов",
  "Отслушать большую часть вручную",
  "Отсеять слабый материал",
  "Разложить оставшееся по жанрам",
  "Подготовить к сету",
];

const vaultSteps = [
  "Открыть DJ Vault",
  "Выбрать свежий выпуск",
  "Открыть систематизированную подборку",
  "Добавить в Rekordbox / Serato",
  "Играть в своем сете",
];

const results = [
  "Отобранные DJ-подборки",
  "Клубные выпуски",
  "BPM, energy и tempo вписаны в треки",
  "Качественный материал",
  "Больше времени на выступления",
];

const musicDirections = [
  "Русская поп-музыка",
  "Зарубежная поп-музыка",
  "House",
  "Afro house",
  "Indie dance",
  "Breakbeat",
  "Drum & bass",
  "Hip-hop",
  "Baile",
  "Tech house",
  "Retro remixes",
  "Warm up",
  "Open format",
];

const djVersions = [
  "Original tracks",
  "Intro edits",
  "Remixes",
  "Blends",
  "Bootlegs",
  "Специальные версии для сетов",
];

const partyMoments = [
  "Разогрев",
  "Основной танцпол",
  "Поп-хиты",
  "Ретро-блоки",
  "Клубное звучание",
  "Финальные slow tracks",
];

export async function LibraryBlocks() {
  const user = await getCurrentUser();
  const collections = await getCollections();
  const latestCollection = collections[0];

  const hasPaidPlan = user ? hasClubAccess(user) : false;
  const isGuest = !user;

  const pricingLabel = !user
    ? "Вступить в клуб"
    : hasPaidPlan
      ? "Открыть подборки"
      : "Оформить доступ";

  const getPricingHref = (packageId: string) => {
    if (!user) {
      return "/register";
    }

    if (hasPaidPlan) {
      return "/collections";
    }

    return `/checkout?package=${packageId}`;
  };

  return (
    <>
      <section className="library-section idea-section" id="service" data-reveal>
        <div className="section-kicker">
          <span>01</span>
          <span>Главная идея DJ Vault</span>
        </div>

        <div className="idea-grid">
          <h2>Я перебираю мусорный материал за вас.</h2>

          <div className="section-copy">
            <p>
              Вы не тратите часы на папки с проходными релизами, случайные
              промо и треки, которые не доживают до танцпола. В DJ Vault
              попадает только материал, который прошел ручной отбор: с BPM,
              energy и tempo внутри треков.
            </p>

            <div className="result-box">
              <span>Результат</span>

              <ul>
                {results.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="library-section content-section" data-reveal>
        <div className="section-kicker">
          <span>02</span>
          <span>Что внутри</span>
        </div>

        <div className="content-grid">
          <h2>Актуальная DJ-библиотека.</h2>

          <div className="content-copy">
            <p>
              В подборки DJ Vault входят треки для разных форматов вечеринки:
              от разогрева и open format до клубного звучания, ретро-блоков и
              финальных slow tracks.
            </p>

            <div className="content-group">
              <span>Направления</span>

              <div className="content-tags">
                {musicDirections.map((direction) => (
                  <span key={direction}>{direction}</span>
                ))}
              </div>
            </div>

            <div className="content-group">
              <span>Версии</span>

              <div className="content-tags">
                {djVersions.map((version) => (
                  <span key={version}>{version}</span>
                ))}
              </div>
            </div>

            <div className="content-group">
              <span>Моменты</span>

              <div className="content-tags">
                {partyMoments.map((moment) => (
                  <span key={moment}>{moment}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="library-section compare-section" data-reveal>
        <div className="section-kicker">
          <span>03</span>
          <span>Знакомо?</span>
        </div>

        <div className="compare-head">
          <h2>Один и тот же процесс каждую неделю</h2>
        </div>

        <div className="compare-grid">
          <article className="compare-panel" data-reveal>
            <div className="panel-topline">
              <span>Обычный путь</span>
              <strong>3-4 часа</strong>
            </div>

            <p>Много ручного отбора перед каждым сетом.</p>

            <ol>
              {ordinarySteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <small>
              В итоге время уходит не на творчество, а на бесконечную
              сортировку.
            </small>
          </article>

          <div className="compare-vs">VS</div>

          <article className="compare-panel compare-panel-dark" data-reveal>
            <div className="panel-topline">
              <span>DJ Vault</span>
              <strong>5 минут</strong>
            </div>

            <p>Систематизированный выпуск без лишней рутины.</p>

            <ul>
              {vaultSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>

            <small>
              Больше времени на творчество, подготовку и выступления.
            </small>
          </article>
        </div>
      </section>

      <section className="library-section founder-section" data-reveal>
        <div className="founder-quote">
          Я прослушиваю сотни новых релизов каждую неделю, чтобы вам не
          пришлось этого делать.
        </div>

        <div className="founder-card">
          <div className="section-kicker">
            <span>04</span>
            <span>Основатель</span>
          </div>

          <h2>Привет! Меня зовут Никита.</h2>

          <p>
            Я DJ с 17-летним опытом. Я знаю, сколько времени уходит на поиск
            действительно подходящего материала. Поэтому каждую неделю собираю
            подборки так, будто готовлю их для собственного сета.
          </p>

          <div className="founder-meta">
            <span>Никита · DJ · основатель DJ Vault</span>
            <strong>17 лет опыта</strong>
          </div>
        </div>
      </section>

      {isGuest ? (
        <section className="library-section demo-section" data-reveal>
          <div className="demo-copy">
            <div className="section-kicker">
              <span>05</span>
              <span>Бесплатный старт</span>
            </div>

            <h2>Попробуйте DJ Vault бесплатно</h2>

            <p>
              После регистрации вы получите демо-доступ к клубу. Без оплаты,
              без банковской карты и без обязательств.
            </p>

            <Link className="button-main" href="/register">
              <span className="button-label">Вступить в клуб</span>
            </Link>
          </div>

          {latestCollection ? (
            <article className="release-card" data-reveal>
              <div className="release-card-head">
                <span className="release-label">Последний выпуск</span>
                <span className="release-meta">
                  {latestCollection.date} · {latestCollection.size}
                </span>
              </div>

              <h3>Подборка #{latestCollection.number}</h3>

              <div className="genre-list">
                {latestGenres.map((genre) => (
                  <span key={genre}>{genre}</span>
                ))}
              </div>

              <div className="release-lock">Доступ по членству</div>
            </article>
          ) : null}
        </section>
      ) : null}

      <section className="library-section archives-section" id="archive" data-reveal>
        <div className="section-kicker">
          <span>{isGuest ? "06" : "05"}</span>
          <span>Клубные выпуски</span>
        </div>

        <div className="archives-head archives-head-action">
          <h2>Предыдущие подборки доступны участникам клуба DJ Vault.</h2>

          <Link className="button-outline" href="/collections">
            <span className="button-label">Открыть подборки</span>
          </Link>
        </div>

        {collections.length > 0 ? (
          <div className="archive-list">
            {collections.slice(0, 3).map((archive) => (
              <Link
                className="archive-row"
                href={`/collections#collection-${archive.number}`}
                key={archive.number}
                data-reveal
              >
                <span>Выпуск #{archive.number}</span>
                <strong>{archive.date}</strong>
                <p>{formatTrackCount(archive.tracks)} · {archive.size}</p>
                <span className="archive-row-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="library-section pricing-section" id="pricing" data-reveal>
        <div className="section-kicker">
          <span>{isGuest ? "07" : "06"}</span>
          <span>Доступ</span>
        </div>

        <div className="pricing-grid">
          {accessPackageList.map((accessPackage) => (
            <article
              className={`pricing-card${
                accessPackage.id === "days-90" ? " pricing-card-featured" : ""
              }`}
              key={accessPackage.id}
              data-reveal
            >
              <div className="plan-topline">
                <div className="plan-head">
                  <h3>{accessPackage.durationDays} дней</h3>
                </div>
                {accessPackage.badge ? <span className="plan-badge">{accessPackage.badge}</span> : null}
              </div>

              <div className="plan-price">
                {accessPackage.oldPrice && <span>{accessPackage.oldPrice}</span>}
                <strong>{accessPackage.price}</strong>
              </div>

              <ul>
                <li>Закрытый клуб DJ Vault</li>
                <li>Еженедельные обновления</li>
                <li>Качественно отобранные подборки</li>
              </ul>

              <div className="plan-action">
                <Link className="button-outline" href={getPricingHref(accessPackage.id)}>
                  <span className="button-label">{pricingLabel}</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
