import { createHash, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { findUserByEmail, updateUserPassword } from "@/lib/auth/store";
import { sendEmail } from "@/lib/email/send";
import { getAppUrl } from "@/lib/payments/yookassa";

const dataDirectory = path.join(process.cwd(), ".data");
const resetFile = path.join(dataDirectory, "password-resets.json");
const tokenLifetimeMs = 60 * 60 * 1000;

type PasswordResetRecord = {
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function readResets(): Promise<PasswordResetRecord[]> {
  try {
    const raw = await readFile(resetFile, "utf8");
    return JSON.parse(raw) as PasswordResetRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeResets(records: PasswordResetRecord[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(resetFile, JSON.stringify(records, null, 2), "utf8");
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email);

  if (!user) {
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const records = await readResets();
  const nextRecords = records.filter(
    (record) => record.userId !== user.id || record.usedAt,
  );
  const resetLink = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  nextRecords.push({
    userId: user.id,
    email: user.email,
    tokenHash: hashToken(token),
    expiresAt: new Date(now + tokenLifetimeMs).toISOString(),
    createdAt: new Date(now).toISOString(),
  });

  await writeResets(nextRecords);

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
  const records = await readResets();
  const tokenHash = hashToken(token);
  const record = records.find(
    (item) =>
      item.tokenHash === tokenHash &&
      !item.usedAt &&
      Date.parse(item.expiresAt) > Date.now(),
  );

  if (!record) {
    throw new Error("RESET_TOKEN_INVALID");
  }

  await updateUserPassword(record.userId, password);

  record.usedAt = new Date().toISOString();
  await writeResets(records);
}
