import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { hasClubAccess } from "@/lib/access/subscription";

export const metadata = {
  title: "Личный кабинет",
  robots: { index: false, follow: false },
};

const dayInMs = 24 * 60 * 60 * 1000;

function getDaysLeft(expiresAt?: string) {
  if (!expiresAt) {
    return null;
  }

  const expiresAtTime = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtTime)) {
    return null;
  }

  return Math.max(0, Math.ceil((expiresAtTime - Date.now()) / dayInMs));
}

function dayLabel(days: number) {
  const mod10 = days % 10;
  const mod100 = days % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "день";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "дня";
  }

  return "дней";
}

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isActiveClub = hasClubAccess(user);
  const hasClubHistory = user.plan === "club";
  const daysLeft = getDaysLeft(user.planExpiresAt) ?? 0;

  return (
    <main className="account-page">
      <section className="account-card">
        <div>
          <div className="account-topline">
            <div className="auth-label account-label">
              <span>Личный кабинет</span>
            </div>

            <form action={logout} className="account-logout-form">
              <button className="account-logout-button" type="submit">
                <span>Выйти</span>
                <svg
                  className="account-logout-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </form>
          </div>

          <h1 className="auth-title">
            {isActiveClub ? "Ваш доступ активен" : "Доступ к клубу не активен"}
          </h1>
          <p className="auth-description">
            Здесь хранится статус подписки и быстрый переход к закрытым
            подборкам DJ Vault.
          </p>
        </div>

        <div className="account-meta account-status">
          <span>Клуб</span>
          <strong className={isActiveClub ? "account-status-paid" : "account-status-free"}>
            {isActiveClub ? "CLUB" : hasClubHistory ? "ИСТЁК" : "FREE"}
          </strong>
        </div>

        {hasClubHistory ? (
          <div className="account-meta">
            <span>Осталось</span>
            <div className="account-renew">
              <strong className="account-days">
                {daysLeft} {dayLabel(daysLeft)}
              </strong>

              <Link className="account-renew-link" href="/pricing">
                Продлить подписку
              </Link>
            </div>
          </div>
        ) : null}

        <div className="account-meta">
          <span>Почта</span>
          <strong>{user.email}</strong>
        </div>

        <div className="account-actions">
          <Link className="button-main" href="/collections">
            <span className="button-label">Открыть подборки</span>
          </Link>

          {!isActiveClub ? (
            <Link className="button-outline" href="/pricing">
              <span className="button-label">Вступить в клуб</span>
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
