import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { getCurrentUser } from "@/lib/auth/session";
import { activateYooKassaPayment } from "@/lib/payments/activate";
import { findStoredPaymentById } from "@/lib/payments/store";
import { getYooKassaPayment } from "@/lib/payments/yookassa";

export const metadata = {
  title: "Статус оплаты",
  robots: { index: false, follow: false },
};

type CheckoutResultPageProps = {
  searchParams?: Promise<{
    payment?: string;
  }>;
};

function resultCopy(status?: string) {
  if (status === "succeeded") {
    return {
      title: "Оплата прошла",
      text: "Подписка активирована. Закрытые DJ-подборки уже доступны.",
      action: "Открыть подборки",
      href: "/collections",
    };
  }

  if (status === "canceled" || status === "failed") {
    return {
      title: "Оплата не прошла",
      text: "Платеж отменен или не был подтвержден. Можно вернуться в клуб и попробовать другой способ.",
      action: "Вступить в клуб",
      href: "/pricing",
    };
  }

  return {
    title: "Проверяем оплату",
    text: "Платеж еще обрабатывается. Обычно это занимает несколько секунд, после подтверждения доступ включится автоматически.",
    action: "В личный кабинет",
    href: "/account",
  };
}

function statusLabel(status: string) {
  if (status === "succeeded") {
    return "Оплачен";
  }

  if (status === "canceled") {
    return "Отменен";
  }

  if (status === "failed") {
    return "Ошибка";
  }

  return "В обработке";
}

export default async function CheckoutResultPage({
  searchParams,
}: CheckoutResultPageProps) {
  const params = searchParams ? await searchParams : {};
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!params.payment) {
    redirect("/pricing");
  }

  const storedPayment = await findStoredPaymentById(params.payment);

  if (!storedPayment || storedPayment.userId !== user.id) {
    redirect("/pricing");
  }

  let status = storedPayment.status;
  let checkFailed = false;

  if (storedPayment.providerPaymentId && storedPayment.status === "pending") {
    try {
      const yookassaPayment = await getYooKassaPayment(
        storedPayment.providerPaymentId,
      );
      const result = await activateYooKassaPayment(yookassaPayment);
      status = result.payment?.status ?? status;
    } catch {
      checkFailed = true;
    }
  }

  const copy = resultCopy(status);

  return (
    <main className="page">
      <ScrollEffects />
      <Header />

      <section className="checkout-result-page">
        <div className="checkout-result-card" data-reveal>
          <div className="section-kicker">
            <span>Оплата</span>
            <span>{storedPayment.method === "sbp" ? "СБП" : "Карта"}</span>
          </div>

          <h1>{copy.title}</h1>
          <p>
            {checkFailed
              ? "Сейчас не удалось проверить статус у ЮKassa. Если деньги списались, подписка обновится после уведомления от платежной системы."
              : copy.text}
          </p>

          <div className="checkout-result-meta">
            <div>
              <span>Сумма</span>
              <strong>{storedPayment.amount} ₽</strong>
            </div>
            <div>
              <span>Статус</span>
              <strong>{statusLabel(status)}</strong>
            </div>
          </div>

          <div className="checkout-result-actions">
            <Link className="button-main" href={copy.href}>
              <span className="button-label">{copy.action}</span>
            </Link>

            {status !== "succeeded" ? (
              <Link className="button-outline" href="/pricing">
                <span className="button-label">Вступить в клуб</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
