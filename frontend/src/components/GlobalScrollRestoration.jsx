import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * OKKAX Global Scroll Restoration
 *
 * Policy:
 * - Fresh load / reload -> always start at top.
 * - Route pathname change -> always start at top.
 * - Query-string changes on the same page do NOT force a reset.
 * - Handles both document scrolling and internal dashboard scroll containers.
 */
export default function GlobalScrollRestoration() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });

      const scrollingElement =
        document.scrollingElement ||
        document.documentElement ||
        document.body;

      if (scrollingElement) {
        scrollingElement.scrollTop = 0;
        scrollingElement.scrollLeft = 0;
      }

      document.querySelectorAll("*").forEach((el) => {
        if (el instanceof HTMLElement && el.scrollTop > 0) {
          el.scrollTop = 0;
        }
      });
    };

    reset();

    const raf1 = requestAnimationFrame(() => {
      reset();
      requestAnimationFrame(reset);
    });

    window.addEventListener("pageshow", reset);
    window.addEventListener("load", reset);

    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("load", reset);
    };
  }, [pathname]);

  return null;
}
