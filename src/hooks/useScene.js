import { useEffect, useState, useRef } from 'react';
import SceneInit from '../lib/SceneInit';

export function useScene() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = new SceneInit('myThreeJsCanvas');
    sceneRef.current = scene;
    scene.onLoadingProgress(setProgress);
    scene.onLoad(() => {
      // Give the GPU a frame to settle before hiding the loader
      requestAnimationFrame(() => setLoading(false));
    });
    scene.initialize();

    // Safety fallback in case the loading manager never fires onLoad
    const fallback = setTimeout(() => setLoading(false), 6000);

    let raf;
    const tick = () => {
      scene.render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, []);

  return { scene: sceneRef, loading, progress };
}
