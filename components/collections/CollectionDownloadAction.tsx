"use client";

import { useState } from "react";

type DownloadResponse = {
  downloadUrl?: string;
  error?: "limit" | "not_configured" | "storage";
  remaining?: number;
};

const errorMessages: Record<NonNullable<DownloadResponse["error"]>, string> = {
  limit: "Лимит скачивания для этого архива исчерпан.",
  not_configured: "Ссылка на архив пока не подключена.",
  storage: "Не удалось подготовить временную ссылку. Напишите в поддержку.",
};

function formatDownloadsLeft(remaining: number, limit: number) {
  if (remaining <= 0) {
    return "Лимит скачивания исчерпан";
  }

  return `Осталось ${remaining} из ${limit} скачиваний`;
}

export function CollectionDownloadAction({
  collectionNumber,
  initialRemaining,
  label,
  limit,
}: {
  collectionNumber: string;
  initialRemaining: number;
  label: string;
  limit: number;
}) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function startDownload() {
    if (isLoading || remaining <= 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/download/${encodeURIComponent(collectionNumber)}?format=json`,
      );
      const result = (await response.json()) as DownloadResponse;

      if (!response.ok || !result.downloadUrl) {
        if (typeof result.remaining === "number") {
          setRemaining(result.remaining);
        }
        setError(
          result.error ? errorMessages[result.error] : "Не удалось начать скачивание.",
        );
        return;
      }

      const frame = document.createElement("iframe");
      frame.hidden = true;
      frame.title = "Загрузка архива";

      let downloadMarkedAsStarted = false;
      const markDownloadAsStarted = () => {
        if (downloadMarkedAsStarted) {
          return;
        }

        downloadMarkedAsStarted = true;
        setRemaining(result.remaining ?? Math.max(0, remaining - 1));
      };

      frame.addEventListener("load", markDownloadAsStarted, { once: true });
      frame.src = result.downloadUrl;
      document.body.appendChild(frame);

      // Ответы с Content-Disposition могут не отправить iframe событие load,
      // хотя загрузка уже появилась в менеджере скачиваний браузера.
      window.setTimeout(markDownloadAsStarted, 1_500);
      window.setTimeout(() => frame.remove(), 60_000);
    } catch {
      setError("Не удалось начать скачивание. Проверьте соединение и повторите.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {remaining <= 0 ? (
        <span className="button-outline button-disabled" aria-disabled="true">
          <span className="button-label">Лимит исчерпан</span>
        </span>
      ) : (
        <button
          className="button-outline collection-download-button"
          disabled={isLoading}
          onClick={startDownload}
          type="button"
        >
          <span className="button-label">
            {isLoading ? "Подготовка…" : label}
          </span>
        </button>
      )}

      {remaining > 0 ? (
        <span
          className="collection-download-hint"
          tabIndex={0}
          aria-label={formatDownloadsLeft(remaining, limit)}
        >
          i
          <span className="collection-download-tooltip" role="tooltip">
            {formatDownloadsLeft(remaining, limit)}
          </span>
        </span>
      ) : null}

      {error ? <p className="collection-download-message">{error}</p> : null}
    </>
  );
}
