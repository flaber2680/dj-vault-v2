import type { CSSProperties } from "react";
import Link from "next/link";

import { FallingCube } from "@/components/sections/FallingCube";
import { getCurrentUser } from "@/lib/auth/session";

const revealDelay = (value: string) => ({
  "--reveal-delay": value,
}) as CSSProperties;

export async function Hero() {
  const user = await getCurrentUser();

  return (
    <>
      <FallingCube />

      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <div
              className="hero-label"
              data-reveal
              style={revealDelay("0ms")}
            >
              Закрытая библиотека для DJ
            </div>

            <h1 className="hero-title">
              <span
                className="hero-title-line"
                data-reveal
                style={revealDelay("90ms")}
              >
                Хватит тратить
              </span>
              <span
                className="hero-title-line"
                data-reveal
                style={revealDelay("160ms")}
              >
                часы
              </span>
              <span
                className="hero-title-line"
                data-reveal
                style={revealDelay("230ms")}
              >
                на перебор
              </span>
              <span
                className="hero-title-line"
                data-reveal
                style={revealDelay("300ms")}
              >
                треков
              </span>
            </h1>

            <p
              className="hero-description"
              data-reveal
              style={revealDelay("390ms")}
            >
              Еженедельные подборки релизов, которые реально работают в клубе.
              Без мусора и лишней траты времени.
            </p>

            <div
              className="hero-buttons"
              data-reveal
              style={revealDelay("470ms")}
            >
              {!user ? (
                <Link className="button-main" href="/register">
                  <span className="button-label">Получить демо архив</span>
                </Link>
              ) : null}

              <Link className={user ? "button-main" : "button-outline"} href="/collections">
                <span className="button-label">Смотреть подборки</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
