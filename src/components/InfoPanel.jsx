export function InfoPanel({ body, onClose }) {
  if (!body) return null;
  const info = body.info || {};

  return (
    <div className="info-panel">
      <div className="info-header">
        <div className="info-title">
          <span className="info-id">{body.id.toUpperCase()}</span>
          <h2>{body.name}</h2>
        </div>
        <button className="info-close" onClick={onClose} title="Fechar">
          ✕
        </button>
      </div>

      {info.type && <div className="info-type">{info.type}</div>}

      <div className="info-grid">
        {info.radiusKm && (
          <div className="info-cell">
            <span className="info-label">Raio</span>
            <span className="info-value">{info.radiusKm}</span>
          </div>
        )}
        {info.mass && (
          <div className="info-cell">
            <span className="info-label">Massa</span>
            <span className="info-value">{info.mass}</span>
          </div>
        )}
        {info.temp && (
          <div className="info-cell">
            <span className="info-label">Temperatura</span>
            <span className="info-value">{info.temp}</span>
          </div>
        )}
      </div>

      {info.funFact && (
        <div className="info-fun">
          <span className="info-fun-label">Você sabia?</span>
          <p>{info.funFact}</p>
        </div>
      )}

      <div className="info-hint">Clique no espaço ou pressione Esc para sair</div>
    </div>
  );
}
