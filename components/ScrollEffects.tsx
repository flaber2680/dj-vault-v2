"use client";

import { useEffect } from "react";

export function ScrollEffects() {
  useEffect(() => {
    const body = document.body;
    const revealPendingClass = "reveal-pending";
    const revealVisibleClass = "is-visible";
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const usesStaticMobilePresentation =
      window.matchMedia("(max-width: 900px)").matches ||
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches;

    const updateHeader = () => {
      body.classList.toggle("is-scrolled", window.scrollY > 8);
    };

    if (usesStaticMobilePresentation) {
      items.forEach((item) => {
        item.classList.remove(revealPendingClass);
        item.classList.remove(revealVisibleClass);
      });

      return () => {
        items.forEach((item) => {
          item.classList.remove(revealPendingClass, revealVisibleClass);
        });
      };
    }

    body.classList.add("reveal-ready");
    updateHeader();

    window.addEventListener("scroll", updateHeader, { passive: true });

    if (prefersReducedMotion) {
      items.forEach((item) => {
        item.classList.remove(revealPendingClass);
        item.classList.add(revealVisibleClass);
      });

      return () => {
        window.removeEventListener("scroll", updateHeader);
        body.classList.remove("is-scrolled", "reveal-ready");
        items.forEach((item) => {
          item.classList.remove(revealPendingClass, revealVisibleClass);
        });
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const target = entry.target as HTMLElement;
          target.classList.remove(revealPendingClass);
          target.classList.add(revealVisibleClass);
          observer.unobserve(target);
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

      item.classList.add(revealPendingClass);
      observer.observe(item);
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateHeader);
      body.classList.remove("is-scrolled", "reveal-ready");
      items.forEach((item) => {
        item.classList.remove(revealPendingClass, revealVisibleClass);
      });
    };
  }, []);

  return null;
}
