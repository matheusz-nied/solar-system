import { useEffect, useState } from 'react';

export function HUD({ scene, onFocus }) {
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showBelts, setShowBelts] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [cinematic, setCinematic] = useState(true);
  const [focusList, setFocusList] = useState([]);
  const [focusedId, setFocusedId] = useState(null);

  // Build the focus dropdown from the scene's focusable bodies
  useEffect(() => {
    const s = scene.current;
    if (!s || !s.focusableBodies) return;
    setFocusList(s.focusableBodies.map((b) => ({ id: b.id, name: b.name })));
  }, [scene, scene.current]);

  useEffect(() => {
    scene.current?.setSpeed(speed);
  }, [speed, scene]);

  useEffect(() => {
    scene.current?.setPaused(paused);
  }, [paused, scene]);

  useEffect(() => {
    scene.current?.setLabelsVisible(showLabels);
  }, [showLabels, scene]);

  useEffect(() => {
    scene.current?.setBeltsVisible(showBelts);
  }, [showBelts, scene]);

  useEffect(() => {
    scene.current?.setStarsVisible(showStars);
  }, [showStars, scene]);

  useEffect(() => {
    scene.current?.setCinematic(cinematic);
  }, [cinematic, scene]);

  useEffect(() => {
    scene.current?.onFocus((body) => {
      setFocusedId(body ? body.id : null);
      onFocus?.(body);
    });
  }, [scene, onFocus]);

  const presets = [0.25, 0.5, 1, 2, 5, 10];

  const toggle = (label, value, setter) => (
    <label className="hud-check" key={label}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => setter(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="hud">
      <div className="hud-card">
        <div className="hud-row">
          <button
            className="hud-btn primary"
            onClick={() => setPaused((p) => !p)}
            title="Pausa/retoma (Espaço)"
          >
            {paused ? '▶ Play' : '❚❚ Pause'}
          </button>
          <span className="hud-speed">{speed.toFixed(2)}×</span>
          <button
            className="hud-btn"
            onClick={() => scene.current?.resetCamera()}
            title="Voltar à visão geral"
          >
            ⤢ Reset
          </button>
        </div>
        <input
          className="hud-slider"
          type="range"
          min="0"
          max="100"
          value={Math.log2(speed + 0.001) * 12.5 + 50}
          onChange={(e) => {
            const v = Number(e.target.value);
            const s = Math.pow(2, (v - 50) / 12.5);
            setSpeed(Math.max(0.05, Math.min(20, s)));
          }}
        />
        <div className="hud-presets">
          {presets.map((p) => (
            <button
              key={p}
              className={`hud-chip ${Math.abs(speed - p) < 0.01 ? 'active' : ''}`}
              onClick={() => setSpeed(p)}
            >
              {p}×
            </button>
          ))}
        </div>

        <div className="hud-divider" />

        <div className="hud-focus">
          <span className="hud-focus-label">Focar</span>
          <select
            className="hud-select"
            value={focusedId ?? ''}
            onChange={(e) => {
              if (e.target.value) scene.current?.focusOn(e.target.value);
              else scene.current?.clearFocus();
            }}
          >
            <option value="">— Visão geral —</option>
            {focusList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="hud-toggles">
          {toggle('Labels', showLabels, setShowLabels)}
          {toggle('Cinturões', showBelts, setShowBelts)}
          {toggle('Estrelas', showStars, setShowStars)}
          {toggle('Cinema', cinematic, setCinematic)}
        </div>

        <div className="hud-hint">
          Clique num astro · teclas 0-9 · Espaço pausa · Esc sai
        </div>
      </div>
    </div>
  );
}
