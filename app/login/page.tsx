import { redirect } from "next/navigation";
import { loginWithEmail } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/AuthCard";
import { getCurrentUser } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid_login:
    "Почта или пароль не совпали. Проверьте данные и попробуйте еще раз.",
  google_not_configured:
    "Google-вход пока не настроен. Добавьте ключи Google OAuth в переменные окружения.",
  google_failed:
    "Google не вернул доступ. Попробуйте еще раз или войдите по почте.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.plan !== "free" ? "/collections" : "/account");
  }

  const params = searchParams ? await searchParams : {};
  const error = params.error ? errorMessages[params.error] : undefined;

  return (
    <AuthCard
      mode="login"
      title="Войти в DJ Vault"
      description="Откройте закрытую библиотеку, свежие подборки и быстрый доступ к архиву."
      action={loginWithEmail}
      error={error}
    />
  );
}
