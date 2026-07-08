import { mkdir, readFile, writeFile } from "fs/promises";
import net from "net";
import path from "path";
import tls from "tls";

const dataDirectory = path.join(process.cwd(), ".data");
const outboxFile = path.join(dataDirectory, "mail-outbox.json");

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

type StoredOutboxMessage = EmailMessage & {
  createdAt: string;
  reason: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
  startTls: boolean;
};

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;
  const port = Number(process.env.SMTP_PORT ?? "465");

  if (!host || !user || !pass || !from || !Number.isFinite(port)) {
    return null;
  }

  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  return {
    host,
    port,
    user,
    pass,
    from,
    secure,
    startTls: process.env.SMTP_STARTTLS
      ? process.env.SMTP_STARTTLS === "true"
      : !secure,
  };
}

async function readOutbox(): Promise<StoredOutboxMessage[]> {
  try {
    const raw = await readFile(outboxFile, "utf8");
    return JSON.parse(raw) as StoredOutboxMessage[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function saveToOutbox(message: EmailMessage, reason: string) {
  const outbox = await readOutbox();

  outbox.push({
    ...message,
    createdAt: new Date().toISOString(),
    reason,
  });

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(outboxFile, JSON.stringify(outbox, null, 2), "utf8");
}

async function safeSaveToOutbox(message: EmailMessage, reason: string) {
  try {
    await saveToOutbox(message, reason);
  } catch (error) {
    console.error("MAIL_OUTBOX_WRITE_FAILED", error);
  }
}

function envelopeEmail(value: string) {
  const match = value.match(/<([^>]+)>/);

  return (match?.[1] ?? value).trim();
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function normalizeBody(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function createSocket(config: SmtpConfig) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = config.secure
      ? tls.connect({
          host: config.host,
          port: config.port,
          servername: config.host,
        })
      : net.connect({
          host: config.host,
          port: config.port,
        });

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    function cleanup() {
      socket.off(config.secure ? "secureConnect" : "connect", onConnect);
      socket.off("error", onError);
    }

    socket.once(config.secure ? "secureConnect" : "connect", onConnect);
    socket.once("error", onError);
    socket.setTimeout(15000, () => {
      socket.destroy(new Error("SMTP_TIMEOUT"));
    });
  });
}

function createSmtpSession(initialSocket: net.Socket) {
  let socket = initialSocket;
  let buffer = "";

  function readResponse() {
    return new Promise<number>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split(/\r?\n/);
        const rest = lines.pop() ?? "";

        buffer = rest;

        for (const line of lines) {
          const match = line.match(/^(\d{3})([ -])/);

          if (match?.[2] === " ") {
            cleanup();
            resolve(Number(match[1]));
            return;
          }
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      function cleanup() {
        socket.off("data", onData);
        socket.off("error", onError);
      }

      socket.on("data", onData);
      socket.once("error", onError);
    });
  }

  async function command(
    value: string,
    expected: number | number[] = 250,
    label = "COMMAND",
  ) {
    socket.write(`${value}\r\n`);
    const code = await readResponse();
    const expectedCodes = Array.isArray(expected) ? expected : [expected];

    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP_${label}_UNEXPECTED_RESPONSE_${code}`);
    }
  }

  function upgradeToTls(host: string) {
    return new Promise<void>((resolve, reject) => {
      const secureSocket = tls.connect(
        {
          socket,
          servername: host,
        },
        () => {
          socket = secureSocket;
          buffer = "";
          socket.setTimeout(15000, () => {
            socket.destroy(new Error("SMTP_TIMEOUT"));
          });
          resolve();
        },
      );

      secureSocket.once("error", reject);
    });
  }

  function close() {
    socket.end();
  }

  return { close, command, readResponse, upgradeToTls };
}

async function sendViaSmtp(message: EmailMessage, config: SmtpConfig) {
  const socket = await createSocket(config);
  const session = createSmtpSession(socket);
  const from = envelopeEmail(config.from);
  const to = envelopeEmail(message.to);
  const headers = [
    `From: ${config.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  const payload = `${headers.join("\r\n")}\r\n\r\n${normalizeBody(message.text)}\r\n.`;

  try {
    await session.readResponse();
    await session.command(`EHLO ${config.host}`, 250, "EHLO");

    if (config.startTls) {
      await session.command("STARTTLS", 220, "STARTTLS");
      await session.upgradeToTls(config.host);
      await session.command(`EHLO ${config.host}`, 250, "EHLO_TLS");
    }

    const authPlain = Buffer.from(`\0${config.user}\0${config.pass}`).toString(
      "base64",
    );

    await session.command(`AUTH PLAIN ${authPlain}`, 235, "AUTH_PLAIN");
    await session.command(`MAIL FROM:<${from}>`, 250, "MAIL_FROM");
    await session.command(`RCPT TO:<${to}>`, [250, 251], "RCPT_TO");
    await session.command("DATA", 354, "DATA");
    await session.command(payload, 250, "MESSAGE_BODY");
    await session.command("QUIT", 221, "QUIT");
  } finally {
    session.close();
  }
}

export async function sendEmail(message: EmailMessage) {
  const config = getSmtpConfig();

  if (!config) {
    await safeSaveToOutbox(message, "SMTP_NOT_CONFIGURED");
    return { sent: false };
  }

  try {
    await sendViaSmtp(message, config);
  } catch (error) {
    const reason =
      error instanceof Error ? `SMTP_SEND_FAILED:${error.message}` : "SMTP_SEND_FAILED";

    console.error("SMTP_SEND_FAILED", error);
    await safeSaveToOutbox(message, reason);

    return { sent: false };
  }

  return { sent: true };
}
