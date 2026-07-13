import { redirect } from "next/navigation";
import { registerWithEmail } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/AuthCard";
import { getCurrentUser } from "@/lib/auth/session";
import { hasClubAccess } from "@/lib/access/subscription";
import { normalizeAuthReturnPath } from "@/lib/auth/return-path";

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid_register:
    "Введите корректную почту и пароль минимум из 10 символов.",
  user_exists:
    "Аккаунт с этой почтой уже есть. Войдите или используйте другую почту.",
  invalid_promo:
    "Такой промокод не найден или больше не активен. Проверьте код или оставьте поле пустым.",
  unknown: "Не получилось создать доступ. Попробуйте еще раз.",
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = searchParams ? await searchParams : {};
  const returnTo = normalizeAuthReturnPath(params.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(returnTo ?? (hasClubAccess(user) ? "/collections" : "/account"));
  }

  const error = params.error ? errorMessages[params.error] : undefined;

  return (
    <AuthCard
      mode="register"
      title="Вступить в клуб"
      description="Зарегистрируйтесь, чтобы открыть демо-доступ к закрытым DJ-подборкам."
      action={registerWithEmail}
      error={error}
      returnTo={returnTo}
    />
  );
}
