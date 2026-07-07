import Link from "next/link";
import { redirect } from "next/navigation";
import { completeCheckout } from "@/app/checkout/actions";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { getCurrentUser } from "@/lib/auth/session";
import { getPaidPlan } from "@/lib/content/plans";

type CheckoutPageProps = {
  searchParams?: Promise<{
    plan?: string;
  }>;
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
              ? `Ваш текущий тариф ${shownPlan?.name ?? plan.name} сохранится. После оплаты добавится ${plan.durationDays} дней к текущему сроку.`
              : "Проверьте тариф и подтвердите оплату. Сейчас это тестовый платеж: после нажатия тариф активируется в вашем кабинете."}
          </p>

          <div className="checkout-return">
            <Link href="/pricing">Вернуться к тарифам</Link>
          </div>
        </div>

        <form action={completeCheckout} className="checkout-card" data-reveal>
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
              <span>Доступ</span>
              <strong>
                {isRenewal ? "Дни добавятся к остатку" : "Сразу после оплаты"}
              </strong>
            </div>
          </div>

          <div className="checkout-methods">
            <span>Способ оплаты</span>

            <div className="checkout-method-grid">
              <div className="checkout-method checkout-method-active">
                Банковская карта
              </div>
              <div className="checkout-method">СБП</div>
            </div>
          </div>

          <div className="checkout-note">
            Реальный эквайринг пока не подключен. Эта кнопка имитирует успешную
            оплату и обновляет срок подписки.
          </div>

          <button className="button-main checkout-submit" type="submit">
            <span className="button-label">Оплатить {plan.price}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
