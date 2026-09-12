import { useEffect, useState } from 'react';

/**
 * Whether a media query currently holds, kept up to date as the window changes.
 */
/*
 * For the handful of places where the layout is not merely styled differently on a narrow screen but built differently -
 * where a pane becomes a sheet, say, and there is a component to mount or not mount rather than a rule to write. Anything
 * that a stylesheet can answer belongs in the stylesheet.
 */
export function useMediaQuery(query: string): boolean {
  const [current, setCurrent] = useState(() => ({ query, matches: window.matchMedia(query).matches }));

  // Asked a different question, answer it now rather than a render later. Cheaper than an effect, and never shows the
  // previous query's answer for a frame.
  if (current.query !== query) {
    setCurrent({ query, matches: window.matchMedia(query).matches });
  }

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setCurrent({ query, matches: event.matches });

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return current.matches;
}
