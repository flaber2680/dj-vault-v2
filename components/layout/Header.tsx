import Link from "next/link";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { hasClubAccess } from "@/lib/access/subscription";

export async function Header() {
  const user = await getCurrentUser();
  const hasPaidPlan = user ? hasClubAccess(user) : false;
  const isAdmin = isAdminUser(user);

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
        {isAdmin ? <Link href="/admin">Админ</Link> : null}
      </nav>

      <div className={isAdmin ? "header-actions is-admin" : "header-actions"}>
        {user ? <span className="header-plan">{hasPaidPlan ? "CLUB" : "FREE"}</span> : null}

        {isAdmin ? <Link className="header-admin-mobile" href="/admin">Админ</Link> : null}

        <Link className="header-button" href={user ? "/account" : "/login"} prefetch={false}>
          <span className="button-label">{user ? "Кабинет" : "Войти"}</span>
        </Link>
      </div>
    </header>
  );
}
