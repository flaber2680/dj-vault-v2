import { redirect } from "next/navigation";
import {
  createPromoCodeAction,
  resetDownloadLimitAction,
  saveCollectionAction,
  updateUserAccessAction,
} from "@/app/admin/actions";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { getUsers } from "@/lib/auth/store";
import { getDownloadRecords } from "@/lib/downloads/store";
import { getDownloadUsageSummary } from "@/lib/downloads/usage";
import {
  getCollections,
  getDemoCollection,
} from "@/lib/content/collections";
import {
  formatReferralPurchase,
  getPromoCodeDashboard,
} from "@/lib/referrals/store";

type AdminPageProps = {
  searchParams?: Promise<{
    error?: string;
    access_error?: string;
    access_updated?: string;
    promo?: string;
    promo_error?: string;
    q?: string;
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

function getDaysRemaining(value?: string) {
  if (!value) {
    return 0;
  }

  const expirationTime = Date.parse(value);

  if (!Number.isFinite(expirationTime)) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil((expirationTime - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}

function matchesUserSearch(
  user: Awaited<ReturnType<typeof getUsers>>[number],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [user.name, user.email, user.plan, user.planExpiresAt ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
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
  const promoDashboard = await getPromoCodeDashboard(users);
  const userQuery = params.q?.trim() ?? "";
  const promoCodesByOwner = promoDashboard.reduce(
    (map, item) => {
      const codes = map.get(item.code.ownerUserId) ?? [];

      codes.push(item.code.code);
      map.set(item.code.ownerUserId, codes);

      return map;
    },
    new Map<string, string[]>(),
  );
  const normalizedUserQuery = userQuery.toLowerCase();
  const filteredUsers = users.filter((item) => {
    const ownerCodes = promoCodesByOwner.get(item.id) ?? [];

    return (
      matchesUserSearch(item, userQuery) ||
      ownerCodes.some((code) => code.toLowerCase().includes(normalizedUserQuery))
    );
  });
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

          {params.promo ? (
            <div className="admin-message">
              Промокод {params.promo} выдан пользователю.
            </div>
          ) : null}

          {params.promo_error ? (
            <div className="admin-message admin-message-error">
              {params.promo_error === "exists"
                ? "Такой промокод уже существует."
                : "Укажите пользователя и уникальный промокод."}
            </div>
          ) : null}

          {params.access_updated ? (
            <div className="admin-message">
              Доступ пользователя {params.access_updated} обновлён.
            </div>
          ) : null}

          {params.access_error ? (
            <div className="admin-message admin-message-error">
              {params.access_error === "days_required"
                ? "Чтобы перевести Free-пользователя в Club, укажите количество дней."
                : params.access_error === "days_not_allowed"
                  ? "Нельзя добавить дни, пока выбран доступ Free."
                  : params.access_error === "not_found"
                    ? "Пользователь не найден."
                    : params.access_error === "required"
                      ? "Выберите пользователя и тип доступа."
                      : "Количество дней должно быть целым числом от 0 до 3650."}
            </div>
          ) : null}
        </div>

        <nav className="admin-nav" aria-label="Разделы админ-панели" data-reveal>
          <a href="#collections">Подборки <span>{items.length}</span></a>
          <a href="#users">Пользователи <span>{users.length}</span></a>
          <a href="#promo-codes">Промокоды <span>{promoDashboard.length}</span></a>
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
            <p>Статус Club, срок доступа и использованные скачивания видны в одной строке.</p>
          </div>

          <form className="admin-search" action="/admin" data-reveal>
            <label className="admin-field">
              <span>Поиск пользователей</span>
              <input
                name="q"
                placeholder="Имя, email, доступ или промокод"
                defaultValue={userQuery}
              />
            </label>
            <button className="button-outline" type="submit">
              <span className="button-label">Найти</span>
            </button>
            {userQuery ? (
              <a className="admin-search-reset" href="/admin#users">
                Сбросить
              </a>
            ) : null}
          </form>

          <div className="admin-users" data-reveal>
            <div className="admin-users-head">
              <span>Пользователь</span><span>Доступ</span><span>Регистрация</span><span>Скачивания</span><span>Промокод</span>
            </div>
            {filteredUsers.length === 0 ? <p className="admin-empty">Пользователи не найдены.</p> : null}
            {filteredUsers.map((item) => {
              const records = downloadRecords.filter((record) => record.userId === item.id);
              const ownerCodes = promoCodesByOwner.get(item.id) ?? [];
              const daysRemaining = getDaysRemaining(item.planExpiresAt);

              return (
                <article className="admin-user-row" key={item.id}>
                  <div className="admin-user-identity"><strong>{item.name}</strong><span>{item.email}</span></div>
                  <form action={updateUserAccessAction} className="admin-user-access">
                    <input name="userId" type="hidden" value={item.id} />
                    <div className="admin-user-access-summary">
                      <strong>{item.plan === "club" ? "CLUB" : "FREE"}</strong>
                      <span>
                        {item.planExpiresAt
                          ? `до ${formatAdminDate(item.planExpiresAt)} · ${daysRemaining} дн.`
                          : "без срока"}
                      </span>
                    </div>
                    <div className="admin-user-access-controls">
                      <select
                        aria-label={`Доступ для ${item.email}`}
                        defaultValue={item.plan}
                        name="accessPlan"
                      >
                        <option value="free">Free</option>
                        <option value="club">Club</option>
                      </select>
                      <input
                        aria-label={`Добавить дней для ${item.email}`}
                        inputMode="numeric"
                        max={3650}
                        min={0}
                        name="days"
                        placeholder="+ дней"
                        step={1}
                        type="number"
                      />
                      <button type="submit">Применить</button>
                    </div>
                  </form>
                  <time>{formatAdminDate(item.createdAt)}</time>
                  <div className="admin-user-downloads">
                    {records.length === 0 ? <span className="admin-muted">Нет скачиваний</span> : records.map((record) => (
                      (() => {
                        const collection = items.find(
                          (collectionItem) => collectionItem.number === record.archiveId,
                        );
                        const usage = getDownloadUsageSummary(
                          record,
                          collection?.downloadLimit ?? record.downloadCount,
                        );

                        return (
                          <form action={resetDownloadLimitAction} className="admin-download-record" key={record.archiveId}>
                            <input name="userId" type="hidden" value={item.id} />
                            <input name="archiveId" type="hidden" value={record.archiveId} />
                            <span className="admin-download-archive">#{record.archiveId}</span>
                            <span className="admin-download-usage">
                              <strong>{usage.label}</strong>
                              <small>использовано / лимит / осталось</small>
                            </span>
                            <button type="submit">Сбросить</button>
                          </form>
                        );
                      })()
                    ))}
                  </div>
                  <div className="admin-user-promo">
                    {ownerCodes.length > 0 ? (
                      <div className="admin-user-promo-list">
                        {ownerCodes.map((code) => (
                          <span key={code}>{code}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="admin-muted">Кодов нет</span>
                    )}
                    <form action={createPromoCodeAction} className="admin-promo-form">
                      <input name="userId" type="hidden" value={item.id} />
                      <input
                        name="code"
                        placeholder="PROMO"
                        aria-label={`Промокод для ${item.email}`}
                      />
                      <button type="submit">Выдать</button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-section" id="promo-codes">
          <div className="admin-section-head" data-reveal>
            <div><span>03 / Партнеры</span><h2>Промокоды</h2></div>
            <p>Регистрация по коду видна сразу, но в зачёт идут только пользователи, которые купили пакет доступа.</p>
          </div>

          <div className="admin-promo-list" data-reveal>
            {promoDashboard.length === 0 ? (
              <p className="admin-empty">Промокоды пока не выданы.</p>
            ) : null}

            {promoDashboard.map((item) => (
              <article className="admin-promo-card" key={item.code.id}>
                <div className="admin-promo-card-head">
                  <div>
                    <span>Промокод</span>
                    <strong>{item.code.code}</strong>
                  </div>
                  <div>
                    <span>Владелец</span>
                    <strong>{item.owner?.email ?? item.code.ownerUserId}</strong>
                  </div>
                  <div>
                    <span>Регистрации</span>
                    <strong>{item.registeredCount}</strong>
                  </div>
                  <div>
                    <span>Оплаченные</span>
                    <strong>{item.paidCount}</strong>
                  </div>
                </div>

                <div className="admin-promo-referrals">
                  {item.referrals.length === 0 ? (
                    <p className="admin-muted">По этому коду пока никто не зарегистрировался.</p>
                  ) : null}

                  {item.referrals.map((referral) => (
                    <div className="admin-promo-referral" key={referral.id}>
                      <span>{referral.user?.email ?? referral.referredUserId}</span>
                      <span>{referral.user?.plan ?? "free"}</span>
                      <span>{formatAdminDate(referral.registeredAt)}</span>
                      <strong>
                        {referral.convertedAt
                          ? `${formatReferralPurchase(referral)} · ${formatAdminDate(referral.convertedAt)}`
                          : "не купил"}
                      </strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section" id="downloads">
          <div className="admin-section-head" data-reveal>
            <div><span>04 / Журнал</span><h2>Скачивания</h2></div>
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
