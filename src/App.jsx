import { useEffect, useState, useRef } from 'react';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { useScene } from './hooks/useScene';
import { HUD } from './components/HUD';
import { HelpOverlay } from './components/HelpOverlay';

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
        <div className="loader-title">Carregando texturas…</div>
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

  return (
    <>
      <canvas id="myThreeJsCanvas" />
      <div id="labels" />
      <PlanetLabels scene={scene} />
      {loading && <Loader progress={progress} />}
      <HUD scene={scene} />
      <HelpOverlay />
    </>
  );
}
