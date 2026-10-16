/**
 * The light half of the ambience.
 *
 * Everything here is a few hundred bytes and decides *whether* the WebGL layer
 * should exist at all. three.js sits behind React.lazy, so a phone, a
 * reduced-motion reader on a narrow window, or a visitor who leaves before
 * idle never downloads it.
 */
import { Suspense, lazy, useEffect, useState } from 'react';

const BokehField = lazy(() => import('./BokehField'));

/** Below this the CSS gradient wash is the whole ambience. */
const MIN_WIDTH = 768;

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

export default function BokehMount({ peak }: { peak: number }) {
  const wide = useMedia(`(min-width: ${MIN_WIDTH}px)`);
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // A phone gets the gradient and nothing else. Not a downgrade of the shader
  // — the shader is simply not downloaded.
  if (!wide) return null;

  return (
    <Suspense fallback={null}>
      <BokehField peak={peak} reduced={reduced} paused={hidden} />
    </Suspense>
  );
}
