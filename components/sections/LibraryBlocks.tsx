import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getCollections, latestGenres } from "@/lib/content/collections";
import { paidPlanList } from "@/lib/content/plans";

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
  "Качественный материал",
  "Больше времени на выступления",
];

export async function LibraryBlocks() {
  const user = await getCurrentUser();
  const collections = await getCollections();
  const latestCollection = collections[0];
  const hasPaidPlan = user ? user.plan !== "free" : false;
  const accessHref = user ? "/collections" : "/register";
  const demoLabel = user ? "Открыть подборки" : "Вступить в клуб";
  const pricingLabel = !user
    ? "Вступить в клуб"
    : hasPaidPlan
      ? "Открыть подборки"
      : "Вступить в клуб";
  const getPricingHref = (planId: string) => {
    if (!user) {
      return "/register";
    }

    if (hasPaidPlan) {
      return "/collections";
    }

    return `/checkout?plan=${planId}`;
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
              попадает только материал, который прошел ручной отбор.
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

      <section className="library-section compare-section" data-reveal>
        <div className="section-kicker">
          <span>02</span>
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
            <span>03</span>
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

      <section className="library-section demo-section" data-reveal>
        <div className="demo-copy">
          <div className="section-kicker">
            <span>04</span>
            <span>Бесплатный старт</span>
          </div>

          <h2>Попробуйте DJ Vault бесплатно</h2>

          <p>
            После регистрации вы получите демо-доступ к клубу. Без оплаты,
            без банковской карты и без обязательств.
          </p>

          <Link className="button-main" href={accessHref}>
            <span className="button-label">{demoLabel}</span>
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

      <section className="library-section archives-section" id="archive" data-reveal>
        <div className="section-kicker">
          <span>05</span>
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
                <p>
                  {archive.size} · {archive.genres}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="library-section pricing-section" id="pricing" data-reveal>
        <div className="section-kicker">
          <span>06</span>
          <span>Тарифы</span>
        </div>

        <div className="pricing-grid">
          {paidPlanList.map((plan) => (
            <article
              className={`pricing-card${plan.name === "Pro" ? " pricing-card-featured" : ""}`}
              key={plan.name}
              data-reveal
            >
              {plan.badge && <span className="plan-badge">{plan.badge}</span>}

              <div className="plan-head">
                <h3>{plan.name}</h3>
                <p>{plan.period}</p>
              </div>

              <div className="plan-price">
                {plan.oldPrice && <span>{plan.oldPrice}</span>}
                <strong>{plan.price}</strong>
              </div>

              <ul>
                <li>Закрытый клуб DJ Vault</li>
                <li>Еженедельные обновления</li>
                <li>Качественно отобранные подборки</li>
              </ul>

              <div className="plan-action">
                <Link className="button-outline" href={getPricingHref(plan.id)}>
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
