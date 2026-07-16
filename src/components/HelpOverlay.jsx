import { useState, useEffect } from 'react';

export function HelpOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 7000);
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
        <h2>☀️ Sistema Solar</h2>
        <ul>
          <li><b>Arrastar</b> — orbitar a câmera</li>
          <li><b>Scroll</b> — zoom</li>
          <li><b>Botão direito</b> — pan</li>
          <li><b>Clicar num astro</b> — focar e seguir</li>
          <li><b>Teclas 0-9</b> — focar rápido (0 = Sol)</li>
          <li><b>Espaço</b> — pausar/retomar</li>
          <li><b>Esc</b> — sair do foco</li>
          <li><b>Slider</b> — velocidade do tempo</li>
        </ul>
        <span className="help-hint">clique para fechar</span>
      </div>
    </div>
  );
}
