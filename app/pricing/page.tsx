import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { getCurrentUser } from "@/lib/auth/session";
import { getPaidPlan, paidPlanList } from "@/lib/content/plans";

const planBenefits = [
  "Закрытый клуб DJ Vault",
  "Еженедельные обновления",
  "Качественно отобранные подборки",
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const isRenewal = user ? user.plan !== "free" : false;
  const currentPlan = isRenewal ? getPaidPlan(user?.plan) : null;

  return (
    <main className="page">
      <ScrollEffects />
      <Header />

      <section className="pricing-page">
        <div className="pricing-page-head" data-reveal>
          <div className="section-kicker">
            <span>{isRenewal ? "Продление" : "Тарифы"}</span>
            <span>DJ Vault</span>
          </div>

          <h1>{isRenewal ? "Продлить подписку" : "Выберите тариф"}</h1>

          <p>
            {isRenewal
              ? `Текущий тариф ${currentPlan?.name ?? "DJ Vault"} сохранится. Выберите срок продления: дни добавятся к текущему остатку.`
              : "Оформите подписку на клуб DJ Vault, закрытые DJ-подборки и еженедельные обновления."}
          </p>
        </div>

        <div className="pricing-grid pricing-page-grid">
          {paidPlanList.map((plan) => {
            const href = !user ? "/register" : `/checkout?plan=${plan.id}`;
            const isCurrentPlan = currentPlan?.id === plan.id;

            return (
              <article
                className={`pricing-card${plan.id === "pro" ? " pricing-card-featured" : ""}${isRenewal && isCurrentPlan ? " pricing-card-current" : ""}`}
                key={plan.id}
                data-reveal
              >
                <span className="plan-badge">
                  {isRenewal && isCurrentPlan ? "Текущий тариф" : plan.badge}
                </span>

                <div className="plan-head">
                  <h3>{isRenewal ? `+${plan.durationDays}` : plan.name}</h3>
                  <p>{isRenewal ? "дней к подписке" : plan.period}</p>
                </div>

                <div className="plan-price">
                  {plan.oldPrice && <span>{plan.oldPrice}</span>}
                  <strong>{plan.price}</strong>
                </div>

                <ul>
                  {planBenefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>

                <div className="plan-action">
                  <Link className="button-outline" href={href}>
                    <span className="button-label">
                      {isRenewal ? "Продлить клуб" : "Вступить в клуб"}
                    </span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
