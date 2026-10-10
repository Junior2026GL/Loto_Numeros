import { useEffect, useState } from 'react';
import Modal from '../../../components/Modal.jsx';
import { BallsRow } from '../../../components/LotteryBall.jsx';
import { IconChart } from '../../../components/icons.jsx';
import { simulateCombination } from '../services/combos.service.js';
import { formatDate } from '../../../utils/dates.js';

const RANGES = [
  [20, 'Últimos 20'],
  [50, 'Últimos 50'],
  [0, 'Todos'],
];

/** Muestra cuántos aciertos habría tenido una combinación en los sorteos pasados. */
export default function SimulateModal({ numbers, onClose }) {
  const [last, setLast] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    simulateCombination({ numeros: numbers, ultimos: last || undefined })
      .then((data) => { if (!cancelled) { setResult(data); setError(''); } })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'No se pudo calcular'); });
    return () => { cancelled = true; };
  }, [numbers, last]);

  const maxCount = result ? Math.max(1, ...Object.values(result.distribucion)) : 1;
  const levels = result ? Array.from({ length: numbers.length + 1 }, (_, i) => i) : [];

  return (
    <Modal
      title="¿Cómo le habría ido?"
      subtitle="Aciertos que habría tenido en sorteos pasados"
      icon={<IconChart />}
      onClose={onClose}
      width={520}
      footer={<button type="button" className="btn-outline" onClick={onClose}>Cerrar</button>}
    >
      <BallsRow numbers={numbers} size="md" />

      <div className="chips-row" style={{ margin: '14px 0' }}>
        {RANGES.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={`chip-btn ${last === value ? 'active' : ''}`}
            onClick={() => { setResult(null); setLast(value); }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}

      {!result && !error && <div className="table-loading"><div className="table-loading-row" /></div>}

      {result && (
        <>
          <div className="sync-result" style={{ marginTop: 0 }}>
            <div><strong>{result.promedio ?? '—'}</strong><span>Aciertos promedio</span></div>
            <div><strong>{result.esperadoPorAzar}</strong><span>Esperado por azar</span></div>
            <div><strong>{result.maximo}</strong><span>Máximo logrado</span></div>
            <div><strong>{result.sorteos}</strong><span>Sorteos revisados</span></div>
          </div>

          <h4 className="dist-title">Cuántos sorteos con cada cantidad de aciertos</h4>
          <div className="dist-bars">
            {levels.map((hits) => {
              const count = result.distribucion[hits] || 0;
              return (
                <div className="dist-row" key={hits}>
                  <span>{hits} {hits === 1 ? 'acierto' : 'aciertos'}</span>
                  <div className="dist-track"><div className="dist-fill" style={{ width: `${(count / maxCount) * 100}%` }} /></div>
                  <b>{count}</b>
                </div>
              );
            })}
          </div>

          {result.mejores.length > 0 && (
            <p className="panel-note" style={{ margin: '12px 0 0' }}>
              Mejores sorteos ({result.maximo} aciertos): {result.mejores.map((m) => formatDate(m.fecha)).join(', ')}.
            </p>
          )}

          <p className="panel-note" style={{ margin: '12px 0 0' }}>
            Es solo una mirada al pasado: <b>no dice nada sobre el próximo sorteo</b>. Cualquier combinación, bien
            elegida o no, queda cerca del promedio del azar.
          </p>
        </>
      )}
    </Modal>
  );
}
