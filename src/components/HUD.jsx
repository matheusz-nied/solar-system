import { useEffect, useState } from 'react';

export function HUD({ scene }) {
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    scene.current?.setSpeed(speed);
  }, [speed, scene]);

  useEffect(() => {
    scene.current?.setPaused(paused);
  }, [paused, scene]);

  useEffect(() => {
    const el = document.getElementById('labels');
    if (el) el.style.display = showLabels ? 'block' : 'none';
  }, [showLabels]);

  const presets = [0.25, 0.5, 1, 2, 5, 10];

  return (
    <div className="hud">
      <div className="hud-card">
        <div className="hud-row">
          <button
            className="hud-btn primary"
            onClick={() => setPaused(p => !p)}
            title="Pausa/retoma"
          >
            {paused ? '▶ Play' : '❚❚ Pause'}
          </button>
          <span className="hud-speed">{speed.toFixed(2)}×</span>
        </div>
        <input
          className="hud-slider"
          type="range"
          min="0"
          max="100"
          value={Math.log2(speed + 0.001) * 12.5 + 50}
          onChange={e => {
            const v = Number(e.target.value);
            const s = Math.pow(2, (v - 50) / 12.5);
            setSpeed(Math.max(0.05, Math.min(20, s)));
          }}
        />
        <div className="hud-presets">
          {presets.map(p => (
            <button
              key={p}
              className={`hud-chip ${Math.abs(speed - p) < 0.01 ? 'active' : ''}`}
              onClick={() => setSpeed(p)}
            >
              {p}×
            </button>
          ))}
        </div>
        <div className="hud-row bottom">
          <label className="hud-check">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={e => setShowLabels(e.target.checked)}
            />
            <span>Labels</span>
          </label>
        </div>
      </div>
    </div>
  );
}
