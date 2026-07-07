import Link from "next/link";

type AuthCardProps = {
  mode: "login" | "register";
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  googleAction: () => Promise<void>;
  error?: string;
};

export function AuthCard({
  mode,
  title,
  description,
  action,
  googleAction,
  error,
}: AuthCardProps) {
  const isRegister = mode === "register";

  return (
    <section className="auth-page">
      <div className="auth-card" data-reveal>
        <div className="auth-topline">
          <div className="auth-label">
            <span>{isRegister ? "Новый доступ" : "Вход в архив"}</span>
          </div>

          <Link className="auth-back" href="/">
            На главную
          </Link>
        </div>

        <h1 className="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>

        {error ? <p className="auth-error">{error}</p> : null}

        <form action={action} className="auth-form">
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
              placeholder="Минимум 6 символов"
              minLength={6}
              required
            />
          </label>

          <button className="button-main auth-submit" type="submit">
            <span className="button-label">
              {isRegister ? "Создать доступ" : "Войти по почте"}
            </span>
          </button>
        </form>

        <div className="auth-divider">
          <span>или</span>
        </div>

        <form action={googleAction} className="auth-provider-form">
          <button className="auth-google" type="submit">
            <span className="auth-google-mark">G</span>
            <span>
              {isRegister ? "Регистрация через Google" : "Войти через Google"}
            </span>
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? "Уже есть доступ?" : "Еще нет аккаунта?"}{" "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </Link>
        </p>
      </div>
    </section>
  );
}
