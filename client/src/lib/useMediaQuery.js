import { useEffect, useState } from "react";

/**
 * Some patterns are only right at one size: a bottom sheet is natural on a
 * phone and looks misplaced on a desktop, where the same content belongs in a
 * popover anchored to whatever opened it. CSS can hide one or the other, but
 * both would still mount — and portalled dialogs escape the parent's classes
 * anyway — so the choice has to be made in JavaScript.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);

    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Matches Tailwind's `md` breakpoint, where the sidebar appears. */
export const useIsDesktop = () => useMediaQuery("(min-width: 768px)");
