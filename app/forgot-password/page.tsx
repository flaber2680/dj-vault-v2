import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth/actions";

export const metadata = {
  title: "Восстановление пароля",
  robots: { index: false, follow: false },
};

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    email?: string;
    error?: string;
    sent?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  rate_limited: "Слишком много попыток. Подождите немного и попробуйте снова.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const isSent = params.sent === "1";
  const email = params.email ?? "";
  const error = params.error ? errorMessages[params.error] : undefined;

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-topline">
          <div className="auth-label">
            <span>Восстановление</span>
          </div>

          <Link className="auth-back" href="/login">
            Ко входу
          </Link>
        </div>

        <h1 className="auth-title">{isSent ? "Проверьте почту" : "Вернуть доступ"}</h1>
        <p className="auth-description">
          {isSent
            ? "Если аккаунт с такой почтой есть, мы отправили ссылку для восстановления пароля."
            : "Укажите почту аккаунта. Мы отправим ссылку, по которой можно задать новый пароль."}
        </p>

        {error ? <p className="auth-error">{error}</p> : null}

        {isSent ? (
          <>
            <div className="auth-confirm">
              {email ? (
                <p>
                  Ссылка отправлена на <strong>{email}</strong>.
                </p>
              ) : null}
              <p>
                Проверьте входящие и папку спам. Иногда письмо может идти
                несколько минут.
              </p>
            </div>

            <Link className="button-main auth-submit auth-home-link" href="/">
              <span className="button-label">На главную</span>
            </Link>
          </>
        ) : (
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
        )}

        <p className="auth-switch">
          Вспомнили пароль? <Link href="/login">Войти</Link>
        </p>
      </div>
    </section>
  );
}
