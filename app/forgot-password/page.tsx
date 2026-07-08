import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth/actions";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    sent?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const notice =
    params.sent === "1"
      ? "Если аккаунт с такой почтой есть, мы отправили ссылку для восстановления пароля."
      : undefined;

  return (
    <section className="auth-page">
      <div className="auth-card" data-reveal>
        <div className="auth-topline">
          <div className="auth-label">
            <span>Восстановление</span>
          </div>

          <Link className="auth-back" href="/login">
            Ко входу
          </Link>
        </div>

        <h1 className="auth-title">Вернуть доступ</h1>
        <p className="auth-description">
          Укажите почту аккаунта. Мы отправим ссылку, по которой можно задать
          новый пароль.
        </p>

        {notice ? <p className="auth-notice">{notice}</p> : null}

        <form action={requestPasswordResetAction} className="auth-form">
          <label className="auth-field">
            <span>Почта</span>
            <input
              className="auth-input"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@email.com"
              required
            />
          </label>

          <button className="button-main auth-submit" type="submit">
            <span className="button-label">Отправить ссылку</span>
          </button>
        </form>

        <p className="auth-switch">
          Вспомнили пароль? <Link href="/login">Войти</Link>
        </p>
      </div>
    </section>
  );
}
