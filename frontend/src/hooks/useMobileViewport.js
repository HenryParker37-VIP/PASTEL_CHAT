import { useEffect } from 'react';

/**
 * Tracks the on-screen keyboard height and writes --keyboard-height to <html>.
 * The chat layout no longer uses JS-driven height for its root container —
 * the root is position:fixed so it follows the visual viewport natively on
 * iOS Safari / PWA and Android Chrome (interactive-widget=resizes-content).
 *
 * --keyboard-height is kept as an informational var for any component that
 * needs it (e.g. bottom-anchored pickers), but is NOT used to resize the
 * main layout.
 */
export function useMobileViewport() {
  useEffect(() => {
    const root = document.documentElement;

    if (!window.visualViewport) {
      root.style.setProperty('--keyboard-height', '0px');
      return;
    }

    const vv = window.visualViewport;

    const update = () => {
      const kh = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty('--keyboard-height', `${kh}px`);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.setProperty('--keyboard-height', '0px');
    };
  }, []);
}
