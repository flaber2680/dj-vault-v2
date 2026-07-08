"use client";

import { useEffect } from "react";

export function ScrollEffects() {
  useEffect(() => {
    const body = document.body;
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isTouchDevice =
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches;

    const updateHeader = () => {
      body.classList.toggle("is-scrolled", window.scrollY > 8);
    };

    body.classList.add("reveal-ready");
    updateHeader();

    window.addEventListener("scroll", updateHeader, { passive: true });

    if (prefersReducedMotion || isTouchDevice) {
      items.forEach((item) => item.classList.add("is-visible"));

      return () => {
        window.removeEventListener("scroll", updateHeader);
        body.classList.remove("is-scrolled", "reveal-ready");
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: .12,
      },
    );

    items.forEach((item, index) => {
      if (!item.style.getPropertyValue("--reveal-delay")) {
        item.style.setProperty("--reveal-delay", `${(index % 6) * 70}ms`);
      }

      observer.observe(item);
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateHeader);
      body.classList.remove("is-scrolled", "reveal-ready");
    };
  }, []);

  return null;
}
