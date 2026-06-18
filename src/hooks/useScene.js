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
    scene.initialize();
    setLoading(false);

    let raf;
    const tick = () => {
      scene.render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return { scene: sceneRef, loading, progress };
}
