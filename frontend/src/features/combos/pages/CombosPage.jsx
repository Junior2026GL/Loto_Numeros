import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader.jsx';
import Pagination from '../../../components/Pagination.jsx';
import LotteryBall, { BallsRow } from '../../../components/LotteryBall.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconAlert, IconCheck, IconSave, IconTrash } from '../../../components/icons.jsx';
import {
  deleteCombination,
  generateCombinations,
  getCombinationsSummary,
  listCombinations,
  saveCombination,
  setCombinationPlayed,
} from '../services/combos.service.js';
import { capitalize, dayName, formatDate } from '../../../utils/dates.js';

const PAGE_SIZE = 10;

/** Números de una combinación; si ya se conoce el resultado, resalta los aciertos. */
function ComboBalls({ numbers, result }) {
  if (!result) return <BallsRow numbers={numbers} size="sm" />;
  const hits = new Set(result);
  return (
    <div className="balls-row">
      {numbers.map((n) => (
        <LotteryBall key={n} number={n} size="sm" tone={hits.has(n) ? 'hit' : 'miss'} />
      ))}
    </div>
  );
}

export default function CombosPage() {
  const toast = useToast();
  const [generated, setGenerated] = useState(null);
  const [savedCodes, setSavedCodes] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [savingCode, setSavingCode] = useState('');
  const [list, setList] = useState({ items: [], total: 0 });
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    listCombinations({ page, pageSize: PAGE_SIZE })
      .then(setList)
      .catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar tus combinaciones'));
    getCombinationsSummary().then(setSummary).catch(() => {});
  }, [page, reload]);

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      setGenerated(await generateCombinations());
      setSavedCodes(new Set());
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron generar las combinaciones');
    } finally {
      setGenerating(false);
    }
  }

  async function save(strategy) {
    setSavingCode(strategy.codigo);
    try {
      await saveCombination({
        estrategia: strategy.codigo,
        numeros: strategy.numeros,
        fecha: generated.proximoSorteo?.fecha,
      });
      setSavedCodes((current) => new Set(current).add(strategy.codigo));
      toast.success('Combinación guardada.');
      setPage(1);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar la combinación');
    } finally {
      setSavingCode('');
    }
  }

  async function togglePlayed(combo) {
    try {
      await setCombinationPlayed(combo.id, !combo.jugada);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo actualizar la combinación');
    }
  }

  async function remove(combo) {
    if (!window.confirm('¿Eliminar esta combinación?')) return;
    try {
      await deleteCombination(combo.id);
      toast.success('Combinación eliminada.');
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar la combinación');
    }
  }

  const next = generated?.proximoSorteo;

  return (
    <>
      <PageHeader
        title="Combinaciones"
        description="Genera combinaciones, guárdalas y compáralas con el resultado real."
      />

      <div className="alert stats-disclaimer">
        <IconAlert width={17} height={17} />
        <span>
          <b>Ninguna estrategia aumenta tu probabilidad de ganar.</b> En un sorteo justo todas las combinaciones
          tienen exactamente la misma probabilidad. Estas herramientas sirven para jugar con método y llevar
          un registro, no para predecir. Juega con responsabilidad.
        </span>
      </div>

      {error && <div className="alert error" style={{ margin: '16px 0' }}>{error}</div>}

      <div className="panel">
        <div className="panel-head-row">
          <div>
            <h3 className="panel-title" style={{ margin: 0 }}>Generador</h3>
            {next && (
              <p className="panel-note" style={{ margin: '4px 0 0' }}>
                Para el sorteo del <b>{capitalize(dayName(next.dia_semana))} {formatDate(next.fecha)}</b> a las {next.hora}.
                Basado en {generated.sorteosAnalizados} sorteos.
              </p>
            )}
          </div>
          <button className="btn-primary" onClick={generate} disabled={generating}>
            {generating ? 'Generando…' : generated ? 'Generar de nuevo' : 'Generar combinaciones'}
          </button>
        </div>

        {generated && (
          <div className="combo-grid">
            {generated.estrategias.map((s) => {
              const saved = savedCodes.has(s.codigo);
              return (
                <div className="combo-card" key={s.codigo}>
                  <div className="combo-card-head">
                    <strong>{s.nombre}</strong>
                    <button
                      className={saved ? 'btn-outline' : 'btn-primary'}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                      onClick={() => save(s)}
                      disabled={saved || savingCode === s.codigo}
                    >
                      {saved ? <><IconCheck width={14} height={14} /> Guardada</> : <><IconSave width={14} height={14} /> Guardar</>}
                    </button>
                  </div>
                  <BallsRow numbers={s.numeros} size="md" />
                  <p>{s.descripcion}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel table-wrap">
        <h3 className="panel-title">Mis combinaciones</h3>

        {list.items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🎟️</span>
            <div className="empty-state-title">Todavía no has guardado combinaciones</div>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Estrategia</th>
                  <th>Números</th>
                  <th>Sorteo</th>
                  <th>Aciertos</th>
                  <th>Jugada</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {list.items.map((combo) => (
                  <tr key={combo.id}>
                    <td>{combo.estrategia_nombre}</td>
                    <td><ComboBalls numbers={combo.numeros} result={combo.resultado} /></td>
                    <td>{formatDate(combo.fecha_sorteo_objetivo)}</td>
                    <td>
                      {combo.aciertos === null
                        ? <span className="badge-muted">Pendiente</span>
                        : <strong>{combo.aciertos} de {combo.numeros.length}</strong>}
                    </td>
                    <td>
                      <label className="switch-row">
                        <input type="checkbox" checked={combo.jugada} onChange={() => togglePlayed(combo)} />
                        <span>{combo.jugada ? 'Sí' : 'No'}</span>
                      </label>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="icon-btn" title="Eliminar" aria-label="Eliminar" onClick={() => remove(combo)}>
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} onPageChange={setPage} />
          </>
        )}
      </div>

      {summary?.estrategias.length > 0 && (
        <div className="panel table-wrap">
          <h3 className="panel-title">Rendimiento por estrategia</h3>
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
    </>
  );
}
