import { useState, useEffect } from 'react';

export function HelpOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) {
    return (
      <button
        className="help-toggle"
        onClick={() => setVisible(true)}
        title="Mostrar ajuda"
      >
        ?
      </button>
    );
  }

  return (
    <div className="help-overlay" onClick={() => setVisible(false)}>
      <div className="help-card">
        <h2>☀️ Solar System</h2>
        <ul>
          <li><b>Arrastar</b> — orbitar a câmera</li>
          <li><b>Scroll</b> — zoom</li>
          <li><b>Botão direito</b> — pan</li>
          <li><b>Slider</b> — velocidade do tempo</li>
        </ul>
        <span className="help-hint">clique para fechar</span>
      </div>
    </div>
  );
}
