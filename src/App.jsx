import { useEffect, useState, useRef } from 'react';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { useScene } from './hooks/useScene';
import { HUD } from './components/HUD';
import { HelpOverlay } from './components/HelpOverlay';
import { InfoPanel } from './components/InfoPanel';

function makeLabel(text) {
  const el = document.createElement('div');
  el.className = 'planet-label';
  el.textContent = text;
  return new CSS2DObject(el);
}

function PlanetLabels({ scene }) {
  const objectsRef = useRef([]);

  useEffect(() => {
    const sceneInstance = scene.current;
    if (!sceneInstance) return;
    const objects = [];
    for (const planet of sceneInstance.planets) {
      const label = makeLabel(planet.data.name);
      label.position.set(0, planet.data.radius + 1.5, 0);
      planet.tilt.add(label);
      objects.push({ planet, label });
    }
    objectsRef.current = objects;
    return () => {
      for (const { planet, label } of objects) {
        planet.tilt.remove(label);
      }
      objectsRef.current = [];
    };
  }, [scene]);

  return null;
}

function Loader({ progress }) {
  return (
    <div className="loader">
      <div className="loader-card">
        <div className="loader-title">Carregando o cosmos…</div>
        <div className="loader-bar">
          <div
            className="loader-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="loader-percent">{Math.round(progress * 100)}%</div>
      </div>
    </div>
  );
}

export default function App() {
  const { scene, loading, progress } = useScene();
  const [focused, setFocused] = useState(null);

  // Clear focus when clicking on empty space (the canvas)
  useEffect(() => {
    const canvas = document.getElementById('myThreeJsCanvas');
    if (!canvas) return;
    const onPointerDown = (e) => {
      // Only clear if clicking the canvas itself, not HUD
      if (e.target === canvas) {
        // Defer to let SceneInit's click handler run first; if it focused a
        // body, onFocus will fire and update `focused` after.
        setTimeout(() => {
          if (!scene.current?._lastClicked) setFocused(null);
          scene.current._lastClicked = null;
        }, 0);
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    return () => canvas.removeEventListener('pointerdown', onPointerDown);
  }, [scene]);

  return (
    <>
      <canvas id="myThreeJsCanvas" />
      <div id="labels" />
      <PlanetLabels scene={scene} />
      {loading && <Loader progress={progress} />}
      <HUD scene={scene} onFocus={setFocused} />
      {focused && (
        <InfoPanel
          body={focused}
          onClose={() => {
            scene.current?.clearFocus();
            setFocused(null);
          }}
        />
      )}
      <HelpOverlay />
    </>
  );
}
