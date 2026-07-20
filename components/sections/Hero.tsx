import type { CSSProperties } from "react";
import Link from "next/link";

import { HeroStrands } from "@/components/effects/HeroStrands";
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
            <HeroStrands />

            <div
              className="hero-label"
              data-reveal
              style={revealDelay("0ms")}
            >
              Закрытый клуб для DJ
            </div>

            <h1 className="hero-title">
              <span
                className="hero-title-line"
                data-reveal
                style={revealDelay("90ms")}
              >
                Меньше поиска.
              </span>
              <span
                className="hero-title-line"
                data-reveal
                style={revealDelay("160ms")}
              >
                Больше музыки.
              </span>
            </h1>

            <p
              className="hero-description"
              data-reveal
              style={revealDelay("390ms")}
            >
              Вам не придётся переслушивать сотни треков. Я уже отобрал
              релизы, которые можно брать в сет.
            </p>

            <div
              className="hero-buttons"
              data-reveal
              style={revealDelay("470ms")}
            >
              {!user ? (
                <Link className="button-main" href="/register">
                  <span className="button-label">Вступить в клуб</span>
                </Link>
              ) : null}

              <Link className={user ? "button-main" : "button-outline"} href="/collections">
                <span className="button-label">Открыть подборки</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
