import { createHash, randomBytes } from "crypto";
import { findUserByEmail, hashPassword } from "@/lib/auth/store";
import {
  consumePasswordReset,
  createPasswordReset,
} from "@/lib/database/repositories/password-resets";
import { sendEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/payments/yookassa";

const tokenLifetimeMs = 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const resetLink = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  createPasswordReset({
    userId: user.id,
    email: user.email,
    tokenHash: hashToken(token),
    expiresAt: new Date(now + tokenLifetimeMs).toISOString(),
  });

  await sendEmail({
    to: user.email,
    subject: "Восстановление пароля DJ Vault",
    text: [
      "Вы запросили восстановление пароля DJ Vault.",
      "",
      "Перейдите по ссылке, чтобы задать новый пароль:",
      resetLink,
      "",
      "Ссылка действует 1 час. Если вы не запрашивали восстановление, просто игнорируйте письмо.",
    ].join("\n"),
  });
}

export async function resetPasswordByToken(token: string, password: string) {
  consumePasswordReset({
    tokenHash: hashToken(token),
    passwordHash: await hashPassword(password),
  });
}
