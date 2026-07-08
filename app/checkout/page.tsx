import Link from "next/link";
import { redirect } from "next/navigation";
import { startCheckout } from "@/app/checkout/actions";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { getCurrentUser } from "@/lib/auth/session";
import { getPaidPlan } from "@/lib/content/plans";

type CheckoutPageProps = {
  searchParams?: Promise<{
    error?: string;
    plan?: string;
  }>;
};

const checkoutErrors: Record<string, string> = {
  invalid_method: "Выберите способ оплаты.",
  payment_link_missing: "ЮKassa не вернула ссылку на оплату. Попробуйте еще раз.",
  payment_request_failed: "Не удалось создать платеж. Попробуйте еще раз чуть позже.",
  payments_not_configured:
    "Оплата еще не настроена на сервере. Добавьте ключи ЮKassa перед запуском.",
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = searchParams ? await searchParams : {};
  const plan = getPaidPlan(params.plan);
  const user = await getCurrentUser();

  if (!plan) {
    redirect("/pricing");
  }

  if (!user) {
    redirect("/register");
  }

  const isRenewal = user.plan !== "free";
  const currentPlan = getPaidPlan(user.plan);
  const shownPlan = isRenewal ? currentPlan : plan;

  return (
    <main className="page">
      <ScrollEffects />
      <Header />

      <section className="checkout-page">
        <div className="checkout-copy" data-reveal>
          <div className="section-kicker">
            <span>{isRenewal ? "Продление" : "Оплата"}</span>
            <span>{shownPlan?.name ?? plan.name}</span>
          </div>

          <h1>{isRenewal ? "Продление подписки" : "Оформление подписки"}</h1>
          <p>
            {isRenewal
              ? `Ваша текущая подписка ${shownPlan?.name ?? plan.name} сохранится. После оплаты добавится ${plan.durationDays} дней к текущему сроку.`
              : "Проверьте подписку и выберите способ оплаты. Доступ к закрытым DJ-подборкам откроется после подтверждения платежа."}
          </p>

          <div className="checkout-return">
            <Link href="/pricing">Вернуться к клубу</Link>
          </div>
        </div>

        <form action={startCheckout} className="checkout-card" data-reveal>
          <input name="plan" type="hidden" value={plan.id} />

          <div className="checkout-plan-head">
            <span>{plan.badge}</span>
            <h2>{shownPlan?.name ?? plan.name}</h2>
            <p>{isRenewal ? `Добавится ${plan.durationDays} дней` : plan.period}</p>
          </div>

          <div className="checkout-total">
            <span>К оплате</span>
            <strong>{plan.price}</strong>
          </div>

          <div className="checkout-meta">
            <div>
              <span>Аккаунт</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>Подписка</span>
              <strong>
                {isRenewal ? "Дни добавятся к остатку" : "Сразу после оплаты"}
              </strong>
            </div>
          </div>

          <div className="checkout-methods">
            <span>Способ оплаты</span>

            <div className="checkout-payment-grid">
              <button
                className="button-main checkout-payment-button"
                name="method"
                type="submit"
                value="sbp"
              >
                <span className="button-label">Оплатить через СБП</span>
              </button>

              <button
                className="button-outline checkout-payment-button"
                name="method"
                type="submit"
                value="bank_card"
              >
                <span className="button-label">Оплатить картой</span>
              </button>
            </div>
          </div>

          <div
            className={
              params.error ? "checkout-note checkout-note-error" : "checkout-note"
            }
          >
            {params.error
              ? (checkoutErrors[params.error] ?? "Оплата не запустилась. Попробуйте еще раз.")
              : "После оплаты ЮKassa вернет вас на сайт. Если вкладка закроется, доступ все равно обновится после уведомления от платежной системы."}
          </div>

          <p className="checkout-terms">
            Нажимая кнопку оплаты, вы принимаете{" "}
            <Link href="/terms">условия использования</Link> и{" "}
            <Link href="/offer">публичную оферту</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}
