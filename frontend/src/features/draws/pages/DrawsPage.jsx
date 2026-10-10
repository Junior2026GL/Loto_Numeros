import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader.jsx';
import Modal from '../../../components/Modal.jsx';
import Pagination from '../../../components/Pagination.jsx';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';
import { BallsRow } from '../../../components/LotteryBall.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconPlus, IconTrash, IconCalendar, IconDownload } from '../../../components/icons.jsx';
import { downloadFile } from '../../../services/download.js';
import {
  createDraw,
  deleteDraw,
  getGame,
  listDraws,
  listMonths,
} from '../services/draws.service.js';
import { capitalize, dayName, formatDate, monthName } from '../../../utils/dates.js';

const PAGE_SIZE = 20;
const SOURCE_LABELS = { IMPORTACION: 'Importado', MANUAL: 'Manual', SCRAPER: 'Automático' };

export default function DrawsPage() {
  const toast = useToast();
  const user = JSON.parse(localStorage.getItem('loto_numeros_user') || 'null');
  const canEdit = user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN';

  const [game, setGame] = useState(null);
  const [months, setMonths] = useState([]);
  const [monthFilter, setMonthFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ fecha: '', numeros: [] });
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    getGame().then(setGame).catch(() => {});
  }, []);

  useEffect(() => {
    listMonths().then(setMonths).catch(() => {});
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const [anio, mes] = monthFilter ? monthFilter.split('-') : [];
    listDraws({ anio, mes, dia: dayFilter, page, pageSize: PAGE_SIZE })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'No se pudo cargar el historial'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [monthFilter, dayFilter, page, reload]);

  function openCreate() {
    setForm({ fecha: '', numeros: Array(game?.cantidad_numeros || 6).fill('') });
    setFormError('');
    setShowCreate(true);
  }

  function setNumber(index, value) {
    const numeros = [...form.numeros];
    numeros[index] = value;
    setForm({ ...form, numeros });
  }

  async function submitCreate(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await createDraw({ fecha: form.fecha, numeros: form.numeros.map(Number) });
      setShowCreate(false);
      toast.success('Sorteo registrado correctamente.');
      setPage(1);
      setReload((n) => n + 1);
    } catch (err) {
      setFormError(err.response?.data?.message || 'No se pudo registrar el sorteo');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteDraw(toDelete.id);
      toast.success('Sorteo eliminado correctamente.');
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar el sorteo');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  async function exportCsv() {
    const [anio, mes] = monthFilter ? monthFilter.split('-') : [];
    try {
      await downloadFile('/sorteos/exportar', 'sorteos.csv', { anio, mes, dia: dayFilter });
    } catch {
      toast.error('No se pudo exportar el historial');
    }
  }

  return (
    <>
      <PageHeader
        title="Sorteos"
        description={game ? `Historial de resultados · ${game.nombre}` : 'Historial de resultados.'}
        actions={(
          <div className="panel-actions">
            <button className="btn-outline" onClick={exportCsv}>
              <IconDownload /> Exportar CSV
            </button>
            {canEdit && (
              <button className="btn-primary" onClick={openCreate} disabled={!game}>
                <IconPlus /> Registrar sorteo
              </button>
            )}
          </div>
        )}
      />

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="panel table-wrap">
        <div className="users-toolbar">
          <div>
            <h3 className="panel-title" style={{ margin: 0 }}>Resultados</h3>
            <span className="badge-muted" style={{ marginTop: 8 }}>
              <IconCalendar /> {data.total} sorteo{data.total === 1 ? '' : 's'}
            </span>
          </div>

          <div className="users-filters">
            <select
              className="users-role-filter"
              value={monthFilter}
              onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
            >
              <option value="">Todos los meses</option>
              {months.map((m) => (
                <option key={`${m.anio}-${m.mes}`} value={`${m.anio}-${m.mes}`}>
                  {capitalize(monthName(m.mes))} {m.anio}
                </option>
              ))}
            </select>
            <select
              className="users-role-filter"
              value={dayFilter}
              onChange={(e) => { setDayFilter(e.target.value); setPage(1); }}
            >
              <option value="">Todos los días</option>
              {(game?.dias_sorteo || []).map((d) => (
                <option key={d} value={d}>{capitalize(dayName(d))}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="table-loading">
            {[0, 1, 2].map((i) => <div className="table-loading-row" key={i} />)}
          </div>
        ) : data.items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🎱</span>
            <div className="empty-state-title">No hay sorteos para mostrar</div>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Día</th>
                  <th>Números</th>
                  <th>Origen</th>
                  {canEdit && <th aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {data.items.map((draw) => (
                  <tr key={draw.id}>
                    <td>{formatDate(draw.fecha)}</td>
                    <td>{capitalize(dayName(draw.dia_semana))}</td>
                    <td><BallsRow numbers={draw.numeros} size="sm" /></td>
                    <td><span className="badge-muted">{SOURCE_LABELS[draw.fuente] || draw.fuente}</span></td>
                    {canEdit && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="icon-btn"
                          title="Eliminar sorteo"
                          aria-label="Eliminar sorteo"
                          onClick={() => setToDelete(draw)}
                        >
                          <IconTrash />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
          </>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Eliminar sorteo"
          message={`¿Eliminar el sorteo del ${formatDate(toDelete.fecha)}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      {showCreate && game && (
        <Modal
          title="Registrar sorteo"
          subtitle={`${game.cantidad_numeros} números del ${game.numero_min} al ${game.numero_max}`}
          icon={<IconCalendar />}
          onClose={() => setShowCreate(false)}
          width={520}
          footer={
            <>
              <button type="button" className="btn-outline" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button type="submit" form="form-crear-sorteo" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </>
          }
        >
          <form id="form-crear-sorteo" className="form-stack" onSubmit={submitCreate}>
            {formError && <div className="alert error">{formError}</div>}

            <label>Fecha del sorteo</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              required
            />

            <label>Números sorteados</label>
            <div className="draw-inputs">
              {form.numeros.map((value, i) => (
                <input
                  key={i}
                  type="number"
                  inputMode="numeric"
                  min={game.numero_min}
                  max={game.numero_max}
                  value={value}
                  onChange={(e) => setNumber(i, e.target.value)}
                  aria-label={`Número ${i + 1}`}
                  required
                />
              ))}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
