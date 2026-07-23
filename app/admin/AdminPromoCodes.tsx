import { formatReferralPurchase, type getPromoCodeDashboard } from "@/lib/referrals/store";

type PromoDashboard = Awaited<ReturnType<typeof getPromoCodeDashboard>>;

type AdminPromoCodesProps = { items: PromoDashboard };

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function AdminPromoCodes({ items }: AdminPromoCodesProps) {
  return (
    <section className="admin-workspace-section">
      <header className="admin-workspace-head">
        <div><span>03 / Партнёры</span><h1>Промокоды</h1><p>Регистрации и оплаченные конверсии по партнёрам.</p></div>
      </header>
      <div className="admin-promo-workspace">
        {items.length === 0 ? <p className="admin-empty">Промокоды пока не выданы.</p> : null}
        {items.map((item) => {
          const conversion = item.registeredCount > 0 ? Math.round((item.paidCount / item.registeredCount) * 100) : 0;
          return (
            <section className="admin-promo-item" key={item.code.id}>
              <header>
                <div><span>Промокод</span><strong>{item.code.code}</strong></div>
                <div><span>Владелец</span><strong>{item.owner?.email ?? item.code.ownerUserId}</strong></div>
                <div><span>Регистрации</span><strong>{item.registeredCount}</strong></div>
                <div><span>Скидка</span><strong>−{item.code.discountPercent}%</strong></div>
                <div><span>Лимит</span><strong>{item.code.discountRegistrationLimit ? `${item.registeredCount}/${item.code.discountRegistrationLimit}` : "—"}</strong></div>
                <div><span>Оплаченные</span><strong>{item.paidCount}</strong></div>
                <div><span>Конверсия</span><strong>{conversion}%</strong></div>
              </header>
              <div className="admin-referral-list">
                {item.referrals.length === 0 ? <p>По этому коду пока никто не зарегистрировался.</p> : null}
                {item.referrals.map((referral) => (
                  <div key={referral.id}>
                    <strong>{referral.user?.email ?? referral.referredUserId}</strong>
                    <span>{referral.user?.plan === "club" ? "CLUB" : "FREE"}</span>
                    <span>{formatDate(referral.registeredAt)}</span>
                    <em>{referral.convertedAt ? `${formatReferralPurchase(referral)} · ${formatDate(referral.convertedAt)}` : "Не купил"}</em>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
