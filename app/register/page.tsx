import { redirect } from "next/navigation";
import { registerWithEmail } from "@/app/auth/actions";
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
      title="Вступить в клуб"
      description="Зарегистрируйтесь, чтобы открыть демо-доступ к закрытым DJ-подборкам."
      action={registerWithEmail}
      error={error}
    />
  );
}
