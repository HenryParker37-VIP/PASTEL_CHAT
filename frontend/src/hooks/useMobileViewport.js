import { useEffect } from 'react';

/**
 * Mirrors the visible viewport into CSS variables.
 *
 * iOS Safari keeps `position: fixed` relative to the layout viewport while
 * its keyboard is open and may shift visualViewport.offsetTop while it
 * auto-focuses an input. Chat screens use both measurements so their bounded
 * shell follows the actual visible viewport instead of drifting underneath it.
 */
export function useMobileViewport() {
  useEffect(() => {
    const root = document.documentElement;

    if (!window.visualViewport) {
      root.style.setProperty('--keyboard-height', '0px');
      root.style.setProperty('--visual-height', `${window.innerHeight}px`);
      root.style.setProperty('--visual-offset-top', '0px');
      return;
    }

    const vv = window.visualViewport;

    const update = () => {
      const kh = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty('--keyboard-height', `${kh}px`);
      root.style.setProperty('--visual-height', `${Math.round(vv.height)}px`);
      root.style.setProperty('--visual-offset-top', `${Math.max(0, Math.round(vv.offsetTop))}px`);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      root.style.setProperty('--keyboard-height', '0px');
      root.style.removeProperty('--visual-height');
      root.style.removeProperty('--visual-offset-top');
    };
  }, []);
}
