import { redirect } from "next/navigation";
import { loginWithEmail } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/AuthCard";
import { getCurrentUser } from "@/lib/auth/session";
import { hasClubAccess } from "@/lib/access/subscription";
import { normalizeAuthReturnPath } from "@/lib/auth/return-path";

export const metadata = {
  title: "Вход",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    reset?: string;
    next?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid_login:
    "Почта или пароль не совпали. Проверьте данные и попробуйте еще раз.",
  rate_limited: "Слишком много попыток. Подождите немного и попробуйте снова.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const returnTo = normalizeAuthReturnPath(params.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(returnTo ?? (hasClubAccess(user) ? "/collections" : "/account"));
  }

  const error = params.error ? errorMessages[params.error] : undefined;
  const notice =
    params.reset === "success" ? "Пароль обновлен. Теперь можно войти по почте." : undefined;

  return (
    <AuthCard
      mode="login"
      title="Войти в DJ Vault"
      description="Откройте закрытые DJ-подборки для подготовки сетов и выступлений."
      action={loginWithEmail}
      error={error}
      notice={notice}
      returnTo={returnTo}
    />
  );
}
