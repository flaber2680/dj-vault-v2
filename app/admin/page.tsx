import { redirect } from "next/navigation";
import { AdminCollections } from "@/app/admin/AdminCollections";
import { AdminDownloads } from "@/app/admin/AdminDownloads";
import { AdminNavigation } from "@/app/admin/AdminNavigation";
import { AdminPromoCodes } from "@/app/admin/AdminPromoCodes";
import { AdminUsers } from "@/app/admin/AdminUsers";
import { getAdminViewState } from "@/lib/admin/view-state";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { getUsers } from "@/lib/auth/store";
import { getCollections, getDemoCollection } from "@/lib/content/collections";
import { getDownloadRecords } from "@/lib/downloads/store";
import { getPromoCodeDashboard } from "@/lib/referrals/store";

type AdminPageProps = {
  searchParams?: Promise<{
    section?: string;
    collection?: string;
    user?: string;
    q?: string;
    cq?: string;
    dq?: string;
    error?: string;
    access_error?: string;
    access_updated?: string;
    promo?: string;
    promo_error?: string;
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
  return Number.isFinite(latestNumber)
    ? String(latestNumber + 1).padStart(3, "0")
    : "001";
}

function getStatusMessage(params: Awaited<NonNullable<AdminPageProps["searchParams"]>>) {
  if (params.saved) return { text: `Подборка #${params.saved} сохранена.`, error: false };
  if (params.reset) return { text: `Лимит скачиваний для архива #${params.reset} сброшен.`, error: false };
  if (params.promo) return { text: `Промокод ${params.promo} выдан пользователю.`, error: false };
  if (params.access_updated) return { text: `Доступ пользователя ${params.access_updated} обновлён.`, error: false };
  if (params.error === "required") return { text: "Заполните номер, дату, количество треков и жанры.", error: true };
  if (params.error === "reset_required") return { text: "Не удалось определить пользователя или архив.", error: true };
  if (params.promo_error === "exists") return { text: "Такой промокод уже существует.", error: true };
  if (params.promo_error) return { text: "Укажите пользователя и уникальный промокод.", error: true };
  if (params.access_error === "days_required") return { text: "Для перевода Free-пользователя в Club укажите количество дней.", error: true };
  if (params.access_error === "days_not_allowed") return { text: "Нельзя добавить дни, пока выбран доступ Free.", error: true };
  if (params.access_error === "not_found") return { text: "Пользователь не найден.", error: true };
  if (params.access_error) return { text: "Проверьте тип доступа и количество дней.", error: true };
  return null;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!isAdminUser(currentUser)) redirect("/account");

  const params = searchParams ? await searchParams : {};
  const collectionsPromise = getCollections({ includeInactive: true });
  const demoPromise = getDemoCollection();
  const downloadsPromise = getDownloadRecords();
  const usersPromise = getUsers();
  const [collections, demoCollection, downloadRecords, users] = await Promise.all([
    collectionsPromise,
    demoPromise,
    downloadsPromise,
    usersPromise,
  ]);
  const promoDashboard = await getPromoCodeDashboard(users);
  const items = [demoCollection, ...collections];
  const view = getAdminViewState(params, items, users);
  const userQuery = params.q?.trim() ?? "";
  const collectionQuery = params.cq?.trim() ?? "";
  const downloadQuery = params.dq?.trim() ?? "";
  const normalizedUserQuery = userQuery.toLowerCase();
  const codesByOwner = promoDashboard.reduce((map, item) => {
    const codes = map.get(item.code.ownerUserId) ?? [];
    codes.push(item.code.code);
    map.set(item.code.ownerUserId, codes);
    return map;
  }, new Map<string, string[]>());
  const filteredUsers = users.filter((user) =>
    [user.name, user.email, user.plan, user.planExpiresAt ?? "", ...(codesByOwner.get(user.id) ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(normalizedUserQuery),
  );
  const normalizedCollectionQuery = collectionQuery.toLowerCase();
  const filteredCollections = items.filter((collection) =>
    [collection.number, collection.date, collection.genres, collection.s3Key ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(normalizedCollectionQuery),
  );
  const userMap = new Map(users.map((user) => [user.id, user]));
  const normalizedDownloadQuery = downloadQuery.toLowerCase();
  const filteredDownloads = downloadRecords.filter((record) => {
    const owner = userMap.get(record.userId);
    return [record.archiveId, owner?.name ?? "", owner?.email ?? "", record.userId]
      .join(" ")
      .toLowerCase()
      .includes(normalizedDownloadQuery);
  });
  const message = getStatusMessage(params);

  return (
    <main className="admin-workspace-page">
      <AdminNavigation
        active={view.section}
        counts={{
          collections: items.length,
          users: users.length,
          "promo-codes": promoDashboard.length,
          downloads: downloadRecords.length,
        }}
      />
      <div className="admin-workspace-main">
        {message ? (
          <div className={message.error ? "admin-toast is-error" : "admin-toast"}>
            {message.text}
          </div>
        ) : null}

        {view.section === "collections" ? (
          <AdminCollections
            collections={filteredCollections}
            nextNumber={getNextCollectionNumber(collections)}
            selected={view.collection}
            isNew={view.isNewCollection}
            query={collectionQuery}
          />
        ) : null}
        {view.section === "users" ? (
          <AdminUsers
            users={filteredUsers}
            selected={view.user}
            collections={items}
            downloads={downloadRecords}
            promoDashboard={promoDashboard}
            query={userQuery}
          />
        ) : null}
        {view.section === "promo-codes" ? <AdminPromoCodes items={promoDashboard} /> : null}
        {view.section === "downloads" ? (
          <AdminDownloads records={filteredDownloads} users={users} query={downloadQuery} />
        ) : null}
      </div>
    </main>
  );
}
