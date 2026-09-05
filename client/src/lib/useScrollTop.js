import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Every route starts at the top.
 *
 * This used to live in Layout, which meant it only covered the routes Layout
 * wraps — and /me, /manage, /admin, /church/register, /give and /learn are all
 * mounted outside it. Following the back link on an application to /me/journey
 * therefore kept the old scroll offset, and a visitor who had read to the
 * bottom of one page arrived level with the footer of the next.
 *
 * A hash link is left alone, and so is a real back or forward: the browser is
 * restoring a position the visitor actually chose, and overriding it is the
 * other half of the same bug.
 */
export const useScrollTop = () => {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);
};
