import { redirect } from "next/navigation";
import { loginWithEmail } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/AuthCard";
import { getCurrentUser } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    reset?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid_login:
    "Почта или пароль не совпали. Проверьте данные и попробуйте еще раз.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.plan !== "free" ? "/collections" : "/account");
  }

  const params = searchParams ? await searchParams : {};
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
    />
  );
}
