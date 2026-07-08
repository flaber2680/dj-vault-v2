"use client";

import { useEffect, useRef } from "react";

const TRAIL_DOTS = 10;
const DOT_SIZE = 18;

export function CursorGlow() {
  const dotsRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const shouldDisable =
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldDisable) {
      return;
    }

    const points = Array.from({ length: TRAIL_DOTS }, () => ({
      x: -100,
      y: -100,
    }));
    const target = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    let isVisible = false;
    let frame = 0;

    const handleMouseMove = (event: MouseEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;

      if (!isVisible) {
        isVisible = true;
        points.forEach((point) => {
          point.x = target.x;
          point.y = target.y;
        });
      }
    };

    const handleMouseLeave = () => {
      isVisible = false;
    };

    const animate = () => {
      points.forEach((point, index) => {
        const leader = index === 0 ? target : points[index - 1];
        const ease = index === 0 ? 0.38 : 0.28;

        point.x += (leader.x - point.x) * ease;
        point.y += (leader.y - point.y) * ease;

        const dot = dotsRef.current[index];

        if (dot) {
          const scale = 1 - index * 0.065;
          const opacity = isVisible ? Math.max(0.08, 0.36 - index * 0.028) : 0;

          dot.style.opacity = `${opacity}`;
          dot.style.transform = `translate3d(${point.x - DOT_SIZE / 2}px, ${
            point.y - DOT_SIZE / 2
          }px, 0) scale(${scale})`;
        }
      });

      frame = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    frame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="cursor-trail" aria-hidden="true">
      {Array.from({ length: TRAIL_DOTS }).map((_, index) => (
        <span
          key={index}
          ref={(node) => {
            dotsRef.current[index] = node;
          }}
          className="cursor-trail-dot"
        />
      ))}
    </div>
  );
}
