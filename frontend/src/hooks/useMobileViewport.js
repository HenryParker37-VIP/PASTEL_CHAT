import { useEffect } from 'react';

/**
 * Tracks the virtual keyboard height on mobile and writes it to the
 * --keyboard-height CSS custom property on <html>.
 *
 * Why needed:
 *  - Android Chrome respects `interactive-widget=resizes-content` in the
 *    viewport meta, so dvh already shrinks — no JS needed there.
 *  - iOS Safari does NOT shrink dvh when the keyboard opens. We use the
 *    visualViewport API to detect the visible height change and expose it
 *    as a CSS variable so the chat layout can react without page-level scroll.
 */
export function useMobileViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;

    const update = () => {
      // The gap between the layout viewport height and the visual viewport
      // height is the keyboard (plus any browser chrome that slid away).
      const kh = Math.max(0, window.innerHeight - vv.height);
      root.style.setProperty('--keyboard-height', `${kh}px`);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update(); // run once on mount

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.setProperty('--keyboard-height', '0px');
    };
  }, []);
}
