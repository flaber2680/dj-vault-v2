import Link from "next/link";
import { resetPasswordAction } from "@/app/auth/actions";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid:
    "Ссылка недействительна или устарела. Запросите восстановление еще раз.",
  short_password: "Пароль должен быть не короче 6 символов.",
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const token = params.token ?? "";
  const error = params.error ? errorMessages[params.error] : undefined;

  return (
    <section className="auth-page">
      <div className="auth-card" data-reveal>
        <div className="auth-topline">
          <div className="auth-label">
            <span>Новый пароль</span>
          </div>

          <Link className="auth-back" href="/login">
            Ко входу
          </Link>
        </div>

        <h1 className="auth-title">Сменить пароль</h1>
        <p className="auth-description">
          Задайте новый пароль для доступа к DJ Vault.
        </p>

        {error ? <p className="auth-error">{error}</p> : null}

        {token ? (
          <form action={resetPasswordAction} className="auth-form">
            <input name="token" type="hidden" defaultValue={token} />

            <label className="auth-field">
              <span>Новый пароль</span>
              <input
                className="auth-input"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Минимум 6 символов"
                minLength={6}
                required
              />
            </label>

            <button className="button-main auth-submit" type="submit">
              <span className="button-label">Сохранить пароль</span>
            </button>
          </form>
        ) : (
          <p className="auth-error">
            Ссылка для восстановления не найдена. Запросите письмо еще раз.
          </p>
        )}

        <p className="auth-switch">
          Нужна новая ссылка? <Link href="/forgot-password">Восстановить доступ</Link>
        </p>
      </div>
    </section>
  );
}
