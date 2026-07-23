import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { getCurrentUser } from "@/lib/auth/session";
import { hasClubAccess } from "@/lib/access/subscription";
import { accessPackageList } from "@/lib/content/plans";
import { getPromoDiscountEligibility } from "@/lib/referrals/store";
import { calculateDiscountedAmount, formatRub } from "@/lib/payments/discount";

export const metadata = {
  title: "Доступ в клуб",
};

const planBenefits = [
  "Закрытый клуб DJ Vault",
  "Еженедельные обновления",
  "Качественно отобранные подборки",
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const isRenewal = user ? hasClubAccess(user) : false;
  const promoDiscount = await getPromoDiscountEligibility(user?.id);

  return (
    <main className="page">
      <ScrollEffects />
      <Header />

      <section className="pricing-page">
        <div className="pricing-page-head" data-reveal>
          <div className="section-kicker">
            <span>{isRenewal ? "Продление" : "Доступ"}</span>
            <span>DJ Vault</span>
          </div>

          <h1>{isRenewal ? "Продлить доступ" : "Выберите срок доступа"}</h1>

          <p>
            {isRenewal
              ? "Выберите пакет: оплаченные дни добавятся к текущему остатку доступа."
              : "Все пакеты открывают одинаковый доступ к клубу DJ Vault. Отличаются только срок и цена."}
          </p>
        </div>

        <div className="pricing-grid pricing-page-grid">
          {accessPackageList.map((accessPackage) => {
            const discountedAmount = promoDiscount
              ? calculateDiscountedAmount(accessPackage.amount, promoDiscount.percent)
              : null;
            const href = !user
              ? "/register"
              : `/checkout?package=${accessPackage.id}`;

            return (
              <article
                className={`pricing-card${accessPackage.id === "days-90" ? " pricing-card-featured" : ""}`}
                key={accessPackage.id}
                data-reveal
              >
                <div className="plan-topline">
                  <div className="plan-head">
                    <h3>{accessPackage.durationDays} дней</h3>
                  </div>
                  <span className="plan-badge">
                    {accessPackage.badge}
                  </span>
                </div>

                <div className="plan-price">
                  {(discountedAmount || accessPackage.oldPrice) && <span>{discountedAmount ? accessPackage.price : accessPackage.oldPrice}</span>}
                  <strong>{discountedAmount ? formatRub(discountedAmount) : accessPackage.price}</strong>
                </div>

                {promoDiscount ? <p className="plan-discount">Промокод {promoDiscount.code}: −{promoDiscount.percent}% на первую покупку</p> : null}

                <ul>
                  {planBenefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>

                <div className="plan-action">
                  <Link className="button-outline" href={href}>
                    <span className="button-label">
                      {isRenewal ? "Добавить дни" : "Оформить доступ"}
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
