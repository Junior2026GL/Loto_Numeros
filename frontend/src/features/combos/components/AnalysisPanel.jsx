import { useEffect, useState } from 'react';
import { useToast } from '../../../components/ToastProvider.jsx';
import OddsPanel from './OddsPanel.jsx';
import { getCombinationsSummary, getRetrospective } from '../services/combos.service.js';

/** Probabilidades, rendimiento de tus combinaciones y prueba de las estrategias con sorteos pasados. */
export default function AnalysisPanel({ reload }) {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    getCombinationsSummary().then(setSummary).catch(() => {});
  }, [reload]);

  async function run() {
    setRunning(true);
    try {
      setBacktest(await getRetrospective());
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo ejecutar la prueba');
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <OddsPanel />

      {summary?.estrategias.length > 0 && (
        <div className="panel table-wrap">
          <h3 className="panel-title">Rendimiento de tus combinaciones</h3>
          <p className="panel-note">
            Aciertos promedio de tus combinaciones ya evaluadas. Por puro azar se esperan
            <b> {summary.promedioPorAzar}</b> aciertos por combinación: si una estrategia queda cerca de ese
            valor, no está haciendo nada mejor que el azar (con pocas combinaciones la diferencia es solo suerte).
          </p>
          <table>
            <thead>
              <tr>
                <th>Estrategia</th>
                <th>Guardadas</th>
                <th>Evaluadas</th>
                <th>Promedio</th>
                <th>Máximo</th>
              </tr>
            </thead>
            <tbody>
              {summary.estrategias.map((e) => (
                <tr key={e.estrategia}>
                  <td>{e.nombre}</td>
                  <td>{e.guardadas}</td>
                  <td>{e.evaluadas}</td>
                  <td>{e.promedio ?? '—'}</td>
                  <td>{e.maximo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel table-wrap">
        <div className="panel-head-row">
          <div>
            <h3 className="panel-title" style={{ margin: 0 }}>¿Funcionan las estrategias? Prueba con sorteos pasados</h3>
            <p className="panel-note" style={{ margin: '4px 0 0' }}>
              Para cada sorteo pasado se generan combinaciones usando solo lo que se sabía antes de ese sorteo
              y se cuentan los aciertos reales.
            </p>
          </div>
          <button className="btn-outline" onClick={run} disabled={running}>
            {running ? 'Calculando…' : backtest ? 'Repetir prueba' : 'Ejecutar prueba'}
          </button>
        </div>

        {backtest && (backtest.sorteosEvaluados === 0 ? (
          <div className="alert">Todavía no hay suficientes sorteos guardados para hacer la prueba.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Estrategia</th>
                  <th>Aciertos promedio</th>
                  <th>Margen de error</th>
                  <th>Diferencia con el azar</th>
                  <th>Veredicto</th>
                </tr>
              </thead>
              <tbody>
                {backtest.estrategias.map((e) => (
                  <tr key={e.codigo}>
                    <td>{e.nombre}</td>
                    <td><strong>{e.promedio}</strong></td>
                    <td>± {e.margenError}</td>
                    <td>{e.diferenciaVsAzar > 0 ? '+' : ''}{e.diferenciaVsAzar}</td>
                    <td>
                      <span className={`verdict ${e.distinguibleDelAzar ? 'diff' : ''}`}>
                        {e.distinguibleDelAzar ? 'Distinta del azar' : 'Igual al azar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="panel-note" style={{ margin: '12px 0 0' }}>
              Con {backtest.sorteosEvaluados} sorteos evaluados y {backtest.combinacionesPorSorteo} combinaciones por sorteo.
              Por azar se esperan <b>{backtest.promedioPorAzar}</b> aciertos. Si una estrategia dice
              «Igual al azar», su diferencia cae dentro del margen de error: es ruido, no una ventaja real.
            </p>
          </>
        ))}
      </div>
    </>
  );
}
