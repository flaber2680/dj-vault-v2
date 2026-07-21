"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export function FallingCube() {
  const cubeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shouldDisableEffects =
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldDisableEffects) {
      return;
    }

    let frame = 0;

    const updateCube = () => {
      frame = 0;

      const cube = cubeRef.current;

      if (!cube) {
        return;
      }

      const heroTravel = Math.max(1, window.innerHeight * .9);
      const progress = Math.min(1, Math.max(0, window.scrollY / heroTravel));
      const cubeHeight = cube.offsetHeight;
      const startY = -cubeHeight - 120;
      const endY = window.innerHeight + cubeHeight * .35;
      const y = startY + (endY - startY) * progress;
      const x = Math.sin(progress * Math.PI * 1.2) * 90;
      const rotation = -18 + progress * 82;

      cube.style.setProperty("--cube-x", `${x}px`);
      cube.style.setProperty("--cube-y", `${y}px`);
      cube.style.setProperty("--cube-rotation", `${rotation}deg`);
      cube.style.setProperty("--cube-opacity", "1");
    };

    const requestUpdate = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(updateCube);
    };

    updateCube();

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <div className="falling-cube" ref={cubeRef} aria-hidden="true">
      <div className="falling-cube-crop">
        <Image
          src="/images/dj-vault-cube.png"
          alt=""
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 900px) 58vw, 36vw"
          className="falling-cube-image"
        />
      </div>
    </div>
  );
}
