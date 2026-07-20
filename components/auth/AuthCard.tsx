import Link from "next/link";

type AuthCardProps = {
  mode: "login" | "register";
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  error?: string;
  notice?: string;
  returnTo?: string;
};

export function AuthCard({
  mode,
  title,
  description,
  action,
  error,
  notice,
  returnTo,
}: AuthCardProps) {
  const isRegister = mode === "register";
  const switchPath = isRegister ? "/login" : "/register";
  const switchHref = returnTo
    ? `${switchPath}?next=${encodeURIComponent(returnTo)}`
    : switchPath;

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-topline">
          <div className="auth-label">
            <span>{isRegister ? "Новый доступ" : "Вход в сервис"}</span>
          </div>

          <Link className="auth-back" href="/">
            На главную
          </Link>
        </div>

        <h1 className="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>

        {error ? <p className="auth-error">{error}</p> : null}
        {notice ? <p className="auth-notice">{notice}</p> : null}

        <form action={action} className="auth-form">
          {returnTo ? (
            <input name="returnTo" type="hidden" value={returnTo} />
          ) : null}

          {isRegister ? (
            <label className="auth-field">
              <span>Имя</span>
              <input
                className="auth-input"
                name="name"
                autoComplete="name"
                placeholder="Как к вам обращаться"
              />
            </label>
          ) : null}

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

          <label className="auth-field">
            <span>Пароль</span>
            <input
              className="auth-input"
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder="Минимум 10 символов"
              minLength={10}
              required
            />
          </label>

          {isRegister ? (
            <label className="auth-field">
              <span>Промокод</span>
              <input
                className="auth-input"
                name="promoCode"
                autoComplete="off"
                placeholder="Если есть"
              />
            </label>
          ) : null}

          {!isRegister ? (
            <Link className="auth-forgot" href="/forgot-password">
              Забыли пароль?
            </Link>
          ) : null}

          <button className="button-main auth-submit" type="submit">
            <span className="button-label">
              {isRegister ? "Вступить в клуб" : "Войти по почте"}
            </span>
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? "Уже есть доступ?" : "Еще нет аккаунта?"}{" "}
          <Link href={switchHref}>
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </Link>
        </p>
      </div>
    </section>
  );
}
