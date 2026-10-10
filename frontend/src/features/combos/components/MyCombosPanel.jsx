import { useEffect, useState } from 'react';
import Pagination from '../../../components/Pagination.jsx';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';
import Modal from '../../../components/Modal.jsx';
import LotteryBall, { BallsRow } from '../../../components/LotteryBall.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconChart, IconDownload, IconSave, IconTrash } from '../../../components/icons.jsx';
import SimulateModal from './SimulateModal.jsx';
import {
  deleteCombination,
  listCombinations,
  setCombinationPlayed,
  setCombinationPrize,
} from '../services/combos.service.js';
import { downloadFile } from '../../../services/download.js';
import { formatDate } from '../../../utils/dates.js';
import { formatMoney } from '../../../utils/money.js';

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

export default function MyCombosPanel({ reload, onChanged }) {
  const toast = useToast();
  const [list, setList] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [limitAsk, setLimitAsk] = useState(null); // { combo, details }
  const [prizeFor, setPrizeFor] = useState(null);
  const [prizeValue, setPrizeValue] = useState('');
  const [simulating, setSimulating] = useState(null);

  useEffect(() => {
    listCombinations({ page, pageSize: PAGE_SIZE })
      .then((data) => { setList(data); setError(''); })
      .catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar tus combinaciones'));
  }, [page, reload]);

  async function play(combo, confirmar = false) {
    try {
      await setCombinationPlayed(combo.id, !combo.jugada, confirmar);
      onChanged();
    } catch (err) {
      const details = err.response?.data?.details;
      if (err.response?.status === 409 && details?.code === 'LIMIT_EXCEEDED') {
        setLimitAsk({ combo, details });
      } else {
        toast.error(err.response?.data?.message || 'No se pudo actualizar la combinación');
      }
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteCombination(toDelete.id);
      toast.success('Combinación eliminada.');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar la combinación');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  async function savePrize(e) {
    e.preventDefault();
    try {
      await setCombinationPrize(prizeFor.id, prizeValue === '' ? null : Number(prizeValue));
      toast.success('Premio registrado.');
      setPrizeFor(null);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo registrar el premio');
    }
  }

  async function exportCsv() {
    try {
      await downloadFile('/combinaciones/exportar', 'mis-combinaciones.csv');
    } catch {
      toast.error('No se pudo exportar tus combinaciones');
    }
  }

  return (
    <div className="panel table-wrap">
      <div className="panel-head-row">
        <h3 className="panel-title" style={{ margin: 0 }}>Mis combinaciones</h3>
        <button className="btn-outline" onClick={exportCsv}><IconDownload /> Exportar CSV</button>
      </div>

      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}

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
                <th>Costo / Premio</th>
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
                      <input type="checkbox" checked={combo.jugada} onChange={() => play(combo)} />
                      <span>{combo.jugada ? 'Sí' : 'No'}</span>
                    </label>
                  </td>
                  <td>
                    {combo.jugada ? (
                      <div className="money-cell">
                        <span>Costo {formatMoney(combo.costo)}</span>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => { setPrizeFor(combo); setPrizeValue(combo.premio === null ? '' : String(combo.premio)); }}
                        >
                          {combo.premio === null ? 'Registrar premio' : `Premio ${formatMoney(combo.premio)}`}
                        </button>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" title="¿Cómo le habría ido?" aria-label="¿Cómo le habría ido?" onClick={() => setSimulating(combo.numeros)}>
                      <IconChart />
                    </button>
                    <button className="icon-btn" title="Eliminar" aria-label="Eliminar" onClick={() => setToDelete(combo)}>
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

      {toDelete && (
        <ConfirmDialog
          title="Eliminar combinación"
          message="¿Eliminar esta combinación? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      {limitAsk && (
        <ConfirmDialog
          title="Superarías tu límite mensual"
          message={`Llevas ${formatMoney(limitAsk.details.gastado)} de tu límite de ${formatMoney(limitAsk.details.limite)} este mes, y esta combinación cuesta ${formatMoney(limitAsk.details.costo)}. ¿Quieres jugarla de todos modos?`}
          confirmLabel="Jugarla de todos modos"
          danger
          onConfirm={() => { const { combo } = limitAsk; setLimitAsk(null); play(combo, true); }}
          onCancel={() => setLimitAsk(null)}
        />
      )}

      {prizeFor && (
        <Modal
          title="Registrar premio"
          subtitle="Lo que ganó esta combinación"
          icon={<IconSave />}
          onClose={() => setPrizeFor(null)}
          width={400}
          footer={
            <>
              <button type="button" className="btn-outline" onClick={() => setPrizeFor(null)}>Cancelar</button>
              <button type="submit" form="form-premio" className="btn-primary">Guardar</button>
            </>
          }
        >
          <form id="form-premio" className="form-stack" onSubmit={savePrize}>
            <BallsRow numbers={prizeFor.numeros} size="sm" />
            <label>Premio ganado (L)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={prizeValue}
              placeholder="0.00"
              onChange={(e) => setPrizeValue(e.target.value)}
              autoFocus
            />
            <p className="auth-hint">Déjalo vacío para quitar el premio registrado.</p>
          </form>
        </Modal>
      )}

      {simulating && <SimulateModal numbers={simulating} onClose={() => setSimulating(null)} />}
    </div>
  );
}
