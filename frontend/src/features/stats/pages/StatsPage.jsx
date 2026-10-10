import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader.jsx';
import LotteryBall, { BallsRow } from '../../../components/LotteryBall.jsx';
import { IconAlert, IconCalendar, IconChart, IconLogbook } from '../../../components/icons.jsx';
import { getStats } from '../services/stats.service.js';
import { capitalize, dayName, formatDate } from '../../../utils/dates.js';

const LAST_OPTIONS = [
  ['', 'Todo el historial'],
  ['20', 'Últimos 20 sorteos'],
  ['50', 'Últimos 50 sorteos'],
  ['100', 'Últimos 100 sorteos'],
];

function NumberWithCount({ number, caption, tone }) {
  return (
    <div className="ball-with-caption">
      <LotteryBall number={number} size="md" tone={tone} />
      <small>{caption}</small>
    </div>
  );
}

export default function StatsPage() {
  const [filters, setFilters] = useState({ ultimos: '', dia: '' });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getStats(filters)
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'No se pudieron cargar las estadísticas'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  const maxTimes = stats ? Math.max(1, ...stats.frecuencia.map((f) => f.veces)) : 1;
  const hasData = stats && stats.totalSorteos > 0;

  return (
    <>
      <PageHeader
        title="Estadísticas"
        description={stats ? `${stats.juego.nombre} · análisis del historial` : 'Análisis del historial de sorteos.'}
      />

      <div className="alert stats-disclaimer">
        <IconAlert width={17} height={17} />
        <span>
          Son estadísticas <b>descriptivas del pasado</b>. Cada sorteo es independiente: que un número
          salga mucho, poco o lleve tiempo sin salir <b>no cambia su probabilidad</b> en el próximo sorteo.
          Ninguna combinación aumenta tus posibilidades de ganar.
        </span>
      </div>

      {error && <div className="alert error" style={{ margin: '16px 0' }}>{error}</div>}

      <div className="panel">
        <div className="stats-filters">
          <div>
            <label>Sorteos a analizar</label>
            <select value={filters.ultimos} onChange={(e) => setFilters({ ...filters, ultimos: e.target.value })}>
              {LAST_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label>Día del sorteo</label>
            <select value={filters.dia} onChange={(e) => setFilters({ ...filters, dia: e.target.value })}>
              <option value="">Todos los días</option>
              {(stats?.juego.dias_sorteo || []).map((d) => (
                <option key={d} value={d}>{capitalize(dayName(d))}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && !stats ? (
        <div className="table-loading">{[0, 1, 2].map((i) => <div className="table-loading-row" key={i} />)}</div>
      ) : !hasData ? (
        <div className="panel empty-state">
          <span className="empty-state-icon">📊</span>
          <div className="empty-state-title">No hay sorteos para analizar con este filtro</div>
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
          <div className="card-grid">
            <div className="stat-card blue">
              <div className="stat-card-icon blue"><IconLogbook /></div>
              <span>Sorteos analizados</span>
              <strong>{stats.totalSorteos}</strong>
              <small className="stat-hint">{formatDate(stats.desde)} – {formatDate(stats.hasta)}</small>
            </div>
            <div className="stat-card green">
              <div className="stat-card-icon green"><IconChart /></div>
              <span>Esperado por número</span>
              <strong>{stats.esperadoPorNumero}</strong>
              <small className="stat-hint">veces, si todos fueran igual de probables</small>
            </div>
            <div className="stat-card amber">
              <div className="stat-card-icon amber"><IconCalendar /></div>
              <span>Suma promedio de un sorteo</span>
              <strong>{stats.suma.promedio}</strong>
              <small className="stat-hint">mínimo {stats.suma.minimo} · máximo {stats.suma.maximo}</small>
            </div>
          </div>

          {stats.uniformidad && (
            <div className="panel">
              <h3 className="panel-title">¿Son reales las diferencias entre números?</h3>
              <p className="panel-note" style={{ marginBottom: 10 }}>
                Prueba chi-cuadrado: χ² = <b>{stats.uniformidad.chi2}</b> ({stats.uniformidad.gradosLibertad} grados de
                libertad), p = <b>{stats.uniformidad.pValor}</b>.
              </p>
              {stats.uniformidad.pValor >= 0.05 ? (
                <div className="alert">
                  <b>Compatible con el azar.</b> No hay evidencia de que algún número salga más o menos de lo normal:
                  las diferencias que ves en el gráfico son las que se esperan por pura casualidad.
                </div>
              ) : (
                <div className="alert error">
                  <b>Hay diferencias llamativas</b> entre los números. Aun así, al mirar muchas cosas a la vez
                  siempre algo parece raro por casualidad, y eso no significa que el patrón se repita en el próximo sorteo.
                </div>
              )}
              <p className="panel-note" style={{ margin: '10px 0 0' }}>
                Con pocos sorteos la prueba tiene poca fuerza. Es una aproximación: en cada sorteo los 6 números son
                distintos entre sí.
              </p>
            </div>
          )}

          <div className="panel">
            <h3 className="panel-title">Frecuencia de cada número</h3>
            <div className="freq-chart" role="img" aria-label="Frecuencia de cada número">
              <div
                className="freq-expected"
                style={{ bottom: `${(stats.esperadoPorNumero / maxTimes) * 100}%` }}
                title={`Esperado: ${stats.esperadoPorNumero}`}
              />
              {stats.frecuencia.map((f) => (
                <div className="freq-col" key={f.numero} title={`${f.numero}: ${f.veces} veces (${f.porcentaje}% de los sorteos)`}>
                  <span className="freq-value">{f.veces}</span>
                  <div className="freq-bar-area">
                    <div
                      className={`freq-bar-fill ${f.caliente ? 'hot' : ''} ${f.veces === 0 ? 'zero' : ''}`}
                      style={{ height: `${Math.max((f.veces / maxTimes) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="freq-label">{String(f.numero).padStart(2, '0')}</span>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span><i className="dot gold" /> Frecuencia</span>
              <span><i className="dot hot" /> Caliente (últimos {stats.ventanaCalientes} sorteos)</span>
              <span><i className="dot line" /> Esperado ({stats.esperadoPorNumero})</span>
            </div>
          </div>

          <div className="stats-grid">
            <div className="panel">
              <h3 className="panel-title">Más frecuentes</h3>
              <div className="balls-row wide">
                {stats.masFrecuentes.map((f) => (
                  <NumberWithCount key={f.numero} number={f.numero} caption={`${f.veces}×`} />
                ))}
              </div>
            </div>

            <div className="panel">
              <h3 className="panel-title">Menos frecuentes</h3>
              <div className="balls-row wide">
                {stats.masFrios.map((f) => (
                  <NumberWithCount key={f.numero} number={f.numero} caption={`${f.veces}×`} tone="cold" />
                ))}
              </div>
            </div>

            <div className="panel">
              <h3 className="panel-title">Calientes</h3>
              <p className="panel-note">Los que más se repitieron en los últimos {stats.ventanaCalientes} sorteos.</p>
              <BallsRow numbers={stats.calientes} size="md" tone="hot" />
            </div>

            <div className="panel">
              <h3 className="panel-title">Llevan más tiempo sin salir</h3>
              <p className="panel-note">Índice = sorteos sin salir ÷ cada cuántos sorteos suele salir.</p>
              <div className="balls-row wide">
                {stats.atrasados.map((f) => (
                  <NumberWithCount
                    key={f.numero}
                    number={f.numero}
                    caption={`${f.sorteosSinSalir} sorteos · ${f.indiceAtraso}×`}
                    tone="cold"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-title">Parejas que más coincidieron</h3>
            <div className="pairs-row">
              {stats.paresFrecuentes.map((p) => (
                <span className="pair-chip" key={`${p.a}-${p.b}`}>
                  <b>{String(p.a).padStart(2, '0')}</b> + <b>{String(p.b).padStart(2, '0')}</b>
                  <small>{p.veces}×</small>
                </span>
              ))}
            </div>
          </div>

          <div className="stats-grid">
            <div className="panel">
              <h3 className="panel-title">Pares e impares</h3>
              <p className="panel-note">En cuántos sorteos salieron esa cantidad de números pares.</p>
              <div className="parity-list">
                {stats.paridad.map((p) => (
                  <div className="parity-row" key={p.pares}>
                    <span>{p.pares} pares · {p.impares} impares</span>
                    <div className="parity-track">
                      <div className="parity-fill" style={{ width: `${(p.sorteos / stats.totalSorteos) * 100}%` }} />
                    </div>
                    <b>{p.sorteos}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel combo-panel">
              <h3 className="panel-title">Combinación por puntaje</h3>
              <p className="panel-note">
                Los {stats.mejorCombinacion.length} números con mejor puntaje combinado de frecuencia, atraso y
                calientes. Es solo un resumen de los datos, no una predicción.
              </p>
              <BallsRow numbers={stats.mejorCombinacion} size="lg" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
