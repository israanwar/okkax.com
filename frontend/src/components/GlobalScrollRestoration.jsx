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
    // Disable native browser restoration so React controls the initial position.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const reset = () => {
      // Main document scroll.
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });

      const scrollingElement =
        document.scrollingElement ||
        document.documentElement ||
        document.body;

      if (scrollingElement) {
        scrollingElement.scrollTop = 0;
        scrollingElement.scrollLeft = 0;
      }

      // OKKAX dashboard/public pages can contain their own scroll roots.
      // Reset only elements that actually have a non-zero vertical scroll.
      document.querySelectorAll("*").forEach((el) => {
        if (el instanceof HTMLElement && el.scrollTop > 0) {
          el.scrollTop = 0;
        }
      });
    };

    // Immediate reset + two frames to defeat browser/layout restoration
    // that can occur after React starts rendering.
    reset();

    const raf1 = requestAnimationFrame(() => {
      reset();
      requestAnimationFrame(reset);
    });

    return () => cancelAnimationFrame(raf1);
  }, [pathname]);

  return null;
}
