import { redirect } from "next/navigation";
import { registerWithEmail, signInWithGoogle } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/AuthCard";
import { getCurrentUser } from "@/lib/auth/session";

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid_register:
    "Введите корректную почту и пароль минимум из 6 символов.",
  user_exists:
    "Аккаунт с этой почтой уже есть. Войдите или используйте другую почту.",
  google_not_configured:
    "Google-регистрация пока не настроена. Добавьте ключи Google OAuth в переменные окружения.",
  google_failed:
    "Google не вернул доступ. Попробуйте еще раз или зарегистрируйтесь по почте.",
  Configuration:
    "Google-регистрация пока не настроена. Проверьте Google Client ID, Secret и AUTH_SECRET.",
  AccessDenied:
    "Google не подтвердил доступ. Попробуйте еще раз или зарегистрируйтесь по почте.",
  unknown: "Не получилось создать доступ. Попробуйте еще раз.",
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.plan !== "free" ? "/collections" : "/account");
  }

  const params = searchParams ? await searchParams : {};
  const error = params.error ? errorMessages[params.error] : undefined;

  return (
    <AuthCard
      mode="register"
      title="Создать доступ"
      description="Зарегистрируйтесь, чтобы получать подборки без мусора и хранить доступ к архиву в одном месте."
      action={registerWithEmail}
      googleAction={signInWithGoogle}
      error={error}
    />
  );
}
