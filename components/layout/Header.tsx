import Link from "next/link";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import type { TariffPlan } from "@/lib/auth/store";

const planLabels: Record<TariffPlan, string> = {
  free: "FREE",
  start: "START",
  pro: "PRO",
  premium: "PREMIUM",
};

export async function Header() {
  const user = await getCurrentUser();
  const hasPaidPlan = user ? user.plan !== "free" : false;

  return (
    <header className="header">
      <Link className="header-logo" href="/">
        DJ Vault
      </Link>

      <nav className="header-nav">
        {!hasPaidPlan ? <Link href="/#service">Идея</Link> : null}
        <Link href="/collections">Подборки</Link>
        {!hasPaidPlan ? <Link href="/pricing">Клуб</Link> : null}
        {!hasPaidPlan ? <Link href="/terms">Документы</Link> : null}
        {isAdminUser(user) ? <Link href="/admin">Админ</Link> : null}
      </nav>

      <div className="header-actions">
        {user ? <span className="header-plan">{planLabels[user.plan]}</span> : null}

        <Link className="header-button" href={user ? "/account" : "/login"}>
          <span className="button-label">{user ? "Кабинет" : "Войти"}</span>
        </Link>
      </div>
    </header>
  );
}
